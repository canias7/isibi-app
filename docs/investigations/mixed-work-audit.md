# Many changes from one message, across Edit and Add-on (audit, 2026-10-03)

> **The order** (owner, 2026-10-03, pausing the remaining information-limits
> batches): *"Our next priority is whether the builder can complete many
> different requested changes together across Edit and Add-on. Audit and test
> the existing implementation end to end, covering every supported edit
> operation and add-on kind, using the actual registered capabilities rather
> than assuming a list is complete … Distinguish clearly between several tasks
> completed from one user message, several model calls, and tasks actually
> running concurrently. Build one consolidated capability matrix … Trace mixed
> requests through the router, operation picker, scoped instructions,
> Edit/Add-on handoffs, Worker/container execution, queue, publication,
> billing and final reply … Separately prepare a compact real-model test
> batch … do not run paid calls until approved … This round is audit and
> testing only: do not implement new fixes, merge, deploy, or change first
> Build. Finish with a plain-English answer to 'What different things can our
> builder do together from one message today, and what specifically prevents
> it from doing more?'"*
>
> **What this is.** A read of the code at `c088fc52` (the branch
> `claude/help-needed-ehlwlj`); **20 new scenario cases** in
> `test/mixed-work.test.mjs`, each driving the real routes with supplied model
> answers and comparing what was asked with what changed, what was published,
> what was put off or failed, what was charged and what the customer is told;
> and **nine existing suites re-run as evidence** (252 cases). Nothing was
> implemented, merged or deployed; no model was called; nothing was spent;
> Build was not touched. **Every case is a controlled reproduction**: the real
> code with supplied answers. Whether a real router, picker or step gives
> those answers is the real-model batch's to measure (§8).

## The answer, in plain English

**What it can do together from one message today.**
- **Edits, up to four different kinds at once**, on as many pages as they
  touch: the site's colours or fonts, its name or description, sections moved
  or taken off on any page, a photograph swapped, reframed or taken off, the
  menu and the header button, who may submit what, and the web address. Each
  is made where it belongs, one after another, and the site is published once.
- **The same kind of change on several pages** — two sections moved on two
  pages, the wording changed on several pages, several photographs (up to
  eight), the whole menu rewritten — in one message.
- **Additions, many at once**: tables, the functions and outside services
  that use them, scheduled jobs that run those functions, new pages and
  sections, a line of words, a QR code, a 3D scene, photographs — all twelve
  kinds, in one message. The builder designs them in a fixed order so that
  each part can use the parts before it: a function can read a table added
  in the same message, and a job can run that function. One publish, one
  charge.
- **One part failing doesn't stop the others** on the edit side, and the
  failure is named. One part needing a question doesn't stop the others
  either: the rest is done, only the unclear part waits, and answering it
  never repeats or re-charges what was done.

**What stops it doing more.**
1. **The customer isn't told about some of what was done.** Beside a styling
   or layout change, a photograph taken off and a menu change *are made* but
   the reply mentions neither (MW1). A QR code or a 3D scene that was added is
   never mentioned at all (MW5).
2. **Big requests lose parts without a word.** A fifth different kind of edit
   is simply not done and not mentioned (MW2); so is a ninth photograph, an
   eleventh menu link, a twenty-first row change or a fifth table's rules
   (MW4). Additions past their limits, by contrast, are named.
3. **An edit and an addition never finish together.** One message gets one
   route: an edit, or an addition. The other half is held back and the
   customer is told to send it next. "Add a gallery page and put it in the
   menu" is two messages. So is any change to stored entries, or to exact
   wording, beside a different kind of change.
4. **A second part the route can't make can vanish.** Only one part can be
   held back. If a message holds an addition *and* a wording change beside a
   styling change, the addition is held and named — and nothing guarantees
   the wording change is either made or mentioned (MW3).
5. **An addition is all-or-nothing when a part fails its checks**, and a part
   whose designer gives up silently vanishes (MW6). A schedule faster than the
   platform runs is quietly slowed to every fifteen minutes (MW7).
6. **Nothing runs at the same time.** Several changes from one message are
   several model calls run one after another — by your earlier decision, so
   two steps never overwrite each other — and a site runs one job at a time.
   That is safe, and it means a big message takes the sum of its steps'
   time.

## 1. Three things that are easy to confuse

| | What it means here | Today |
|---|---|---|
| **Several tasks from one message** | the customer asks for several changes in one message and the builder makes them all before answering | yes: up to four edit kinds (each on as many pages as it touches), or up to twelve addition kinds; never an edit and an addition together |
| **Several model calls** | one task, or one message, uses more than one model call | always: the router (1), then for an edit the lane picker (1) and one call per lane or step (a page step may add a keep check, a full-writer fallback or a stylesheet correction); for an addition the add-on picker (1), one designer per kind and one page writer; and a reply writer once replies are model-written |
| **Tasks running concurrently** | two of the customer's changes being made at the same moment | **never.** Lanes run in turn (your decision, "run both lanes in turn", written at `worker.js` 24748), steps run in turn ("RUN EVERY STEP IN TURN, AND ANSWER ONCE", 26341: two rungs at once "would race over the same config and the same page source"), designers run in turn (28346), and one job runs per site at a time (the site lock, `supabase/applied/20260905200655_site_serialization.sql`). Only infrastructure overlaps: store reads, an addition's photographs bought together, translations of one publish, and different sites |

## 2. What is registered (read from the code, pinned by the first case)

**Edit layers** (`EDIT_LAYERS`, `site-ask.mjs` 159), one per message from the
router: `data`, `text`, `look`, `page`, `rules`, `picture`, `logo`, `nav`,
`rename`.

**Look lanes** (`LANE_FIELDS`, `site-lanes.mjs` 868): 21, of which **at most
four run per message** (`MAX_LANES`, 251). Where each lane's work runs:

| Runs as | Lanes |
|---|---|
| the look step (one step; each lane its own model call; one write of the stored look) | `css`, `theme`, `brand`, `description`, `wordmark`, `favicon`, `lang`, `langs`, `behavior`, `qr` |
| the page step (one per page; neighbours on one page joined) | `purpose`, `components`, `shape`, `three`, `tsx` |
| the picture step | `images` |
| the menu step | `action` |
| the rules step | `backend` |
| the address step | `slug` |
| a verb (`add` → the add-on step; `remove`, `move` → the page step) | `pages` |
| the full rewrite (Build's pipeline) | `kind` |

**Add-on kinds** (`ADD_KINDS`, `site-add.mjs` 1257): `table`, `row`,
`function`, `api`, `job`, `page`, `component`, `words`, `frame`, `qr`,
`three`, `photo` — designed **in that order**, so each can use what the ones
before it proposed. `frame` alone is handed to the menu step; `row` and
`frame` beside other kinds are set aside and named.

**Counts per message**: lanes 4; photographs changed 8 (`MAX_PICTURE_OPS`);
menu links 10 (`MAX_NAV_ITEMS`); row changes 20 (`MAX_DATA_OPS`); rules
tables 4 (`MAX_RULE_TABLES`); parts put off across a request's turns 4
(`MAX_HELD`); additions: tables 6, functions 6, APIs 4, jobs 4, pages 6,
components 12, rows 12, lines of words 6 (`MAX_ADD_*`); a job at least every
15 minutes (`MIN_JOB_MINUTES`).

## 3. How a mixed message flows today

1. **The router gives one answer for the whole message** (`routeMessage`):
   an intent (`edit`, `addon`, `build`, `ask`, `clarify`) and, for an edit,
   one layer. Its own rule (the `layer` description's last paragraph): a
   layer other than `look` when it alone can make every change; otherwise
   `look` when it can make them all; and a part is held back (`alsoAsked`,
   one passage copied from the message) only when no single answer can make
   it with the rest. `look` reaches styling, the name and description,
   sections on any page, photographs, the menu and button, what the site
   enforces, the web address and taking things off. **It does not reach new
   things (additions), stored entries (`data`) or exact wording (`text`)**,
   so each of those beside another kind is held back for the next message.
2. **On an edit**, the lane picker names up to four lanes and, for each
   change, its own page and words (`scopes`). Lanes become steps (§2's
   table): the look step's lanes run one after another and write the stored
   look once; each page lane runs once per page it is scoped to, on only its
   words; the picture, menu, rules and address steps run once each.
   **Steps run in turn** (`worker.js` 26368): each later step works on the
   pages the earlier ones produced (`publishStep` keeps them in memory) and
   on the look they stored; nothing is published until the end.
3. **One publish** for the whole message, only if something succeeded
   (26469); a stylesheet that matches nothing gets one correction round.
4. **Billing**: the picker's call once per message, then each step its own
   charge (each rounded on its own); on the queue each is a sequenced
   reserve, refunded when nothing ships. A step that fails after its model
   answered keeps its charge beside work that shipped, and the reply says so.
5. **An addition found on the edit side**: a page, QR code or 3D scene the
   site lacks, *alone*, hands the whole message to the add-on step (the
   browser hops, same message); *beside other edit work* it is put off and
   named (W15). The add-on hands a lone menu link (`frame`) to the menu step.
6. **On an addition**, the add-on picker names the kinds; one designer per
   kind runs in `ADD_KINDS` order, each shown the site as the earlier
   proposals left it (`aSite` is rebuilt after every kind, 28346–28420);
   everything is validated before anything is applied — **one refusal
   refuses the whole addition**; then one database migration (tables before
   the functions that read them), the jobs registered, **one page writer
   call** for all the page work, **one publish, one charge** (photographs
   bought on top).
7. **A question**: a step that asks beside steps that run lets them finish;
   the question keeps only its own part, and the answer resumes only that
   part, with nothing done twice and nothing charged twice
   (`live-clarify-continue.test.mjs`). An add-on designer that asks makes
   the whole addition wait — by design, since every part is designed before
   any is applied.
8. **The reply** is composed from the route's final answer: by the page on
   main today (model replies are on the branch, unmerged), and from the same
   answer's facts by a model once merged.

## 4. The capability matrix

"Together" = completed from one message. "In turn" = run one after another
within that message (none run at the same time). "Next message" = held back
and named, for the customer to send. Evidence: **MW** = this round's cases
(`test/mixed-work.test.mjs`), **live** = a closed live test, otherwise the
suite named.

| Combination | From one message today | How it runs | Model calls (routing, then work) | Publishes · charges | What the customer is told | Evidence |
|---|---|---|---|---|---|---|
| The same layout change on two pages | **together** | two page steps, in turn, each on its own page and words | 1 + picker + 1 per page | 1 · one per page step | page's reply: *"Updated the look."* (no page named, MW8); facts name both | MW case 2 |
| Wording on several pages | **together** | one text step | 1 + 1 | 1 · 1 | both changes quoted | MW case 3 |
| Several photographs | **together, up to 8**; the 9th left unsaid | one picture step | 1 + 1 | 1 · 1 | the eight named, the ninth not (MW4) | MW case 13 |
| Several menu changes | **together** (one rewrite); links past 10 dropped unsaid | one menu step | 1 + 1 | 1 · 1 | the menu named | code; IL14 |
| Several row changes | **together, up to 20**; the 21st dropped unsaid | one data step | 1 + 1 | 1 · 1 | the table named | code; IL14 |
| Different changes on one page (move, photo off, menu) | **together** | page, picture, menu steps in turn; the photo comes off the moved page | 1 + picker + 3 | 1 · 3 | **only "Updated /"**: photo and menu untold (MW1) | MW case 4 |
| Different changes across pages, up to four kinds | **together** | look, page, picture, menu steps in turn | 1 + picker + 4 | 1 · 4 | **only the description and /visit**: photo and menu untold (MW1) | MW cases 5–6 (sync, queue) |
| Two changes across pages (description + Visit move; photo off + home move; menu + Visit move) | **together** | as above | 1 + picker + 2 | 1 · 2 | named | live: Tests 6, 7, 8 (runs 57, 60, 66) |
| A fifth kind of edit | **dropped**, unsaid | not run, not put off | — | — | nothing (MW2) | MW case 7 |
| A page removed beside other edits | **together** (the router's removal door runs its own step plus the picker's) | removal step + others in turn | 1 + picker + n | 1 · per step (removal free) | named | `edit-removal-door.test.mjs`; live: Test 5 |
| A rules change beside styling (site with no database) | **together** for the styling; the rule refused and said, free | look step; rules step refuses before its model | 1 + picker + 1 | 1 · 1 | the refusal said | MW case 10 |
| A rules change beside styling (site with a database) | **expected together** | look step + rules step | — | — | — | **untested in a mix** (§7) |
| The address changed beside styling | **expected together**; its refusal path shown | look step + address step | 1 + picker + 2 | 1 · 2 | the refusal said and billed | probe only; success path **untested** (§7) |
| One edit step fails beside others | **the rest together**; the failure named | in turn, no stop | as asked | 1 · each step (the failed one too) | *"…That part still cost 1 credit."* | MW case 8 |
| One edit step asks beside others | **the rest together**; one question kept | in turn | as asked | 1 · the steps that ran | the question shown under the rest | `live-clarify-continue.test.mjs` |
| Its answer | **only the waiting part runs**, nothing repeated or re-charged | — | 1 + picker + the step | 1 · that step | — | same |
| An edit and an addition | **next message** for one half (by design) | the router answers one, holds the other | 1 + the half run | 1 · that half | *"Say “…” and I'll do that next."* | MW cases 9, 11; W15 cases |
| An edit and a data or wording change of another kind | **next message** for one half | the router holds it back | — | — | named | router instructions; W7 cases |
| Two parts the answer cannot make (an addition **and** a wording change beside styling) | one held and named; **the other can vanish** | `alsoAsked` holds one passage | — | — | the held one only (MW3) | MW case 12 |
| A page or QR or 3D addition alone, found by the look step | **together** (handed to the add-on step) | browser hops with the hand-over | +1 route | as the addition | named as an addition | `add-goes-to-addon`, W15 |
| Several additions of different kinds (up to all twelve) | **together** | designers in order, one migration, one page write | 1 + picker + 1 per kind + 1 page writer | 1 · 1 | most named — **not a QR code or a 3D scene** (MW5) | MW cases 14–15 |
| A table, then a function, an API and a job that use it | **together**; each part sees the earlier ones | in dependency order | 1 + picker + 4 + 1 | 1 · 1 | all four named | MW case 14 |
| A new page, then things placed on it (component, QR, 3D, words) | **together**; each designer told the page is coming | in order, one page write | 1 + picker + 5 + 1 | 1 · 1 | the page and the words named; QR and 3D not (MW5) | MW case 15 |
| A new page, then a menu link to it | **next message** for the link (set aside, named) | the link is the menu step's | — | — | *"…a separate step…"* | MW case 16 |
| A new page and a new entry in a list | **next message** for the entry | set aside, named | — | — | *"I left out one row…"* | MW case 16 |
| An addition and a styling change | **next message** for the styling | the router holds it | — | — | named at the end | MW case 11 |
| One addition's designer declines | **the rest together**; the declined part **vanishes** | — | — | 1 · 1 | only what was added (MW6) | MW case 17 |
| One addition fails its checks | **nothing** (all or nothing), the reason said | validation before any apply | — | 0 · 0 | the reason, "Nothing was changed" | MW case 18 |
| One addition's designer asks | **the whole addition waits** (by design) | — | — | 0 · 0 | the question | `live-clarify-continue.test.mjs` |
| More additions of one kind than allowed | **together up to the limit**; the rest named | — | — | 1 · 1 | *"I left out “…”"* | MW case 19 |
| A schedule faster than every 15 minutes | **together**, slowed to 15 **without saying so** | — | — | 1 · 1 | *"(every 15 minutes)"* (MW7) | MW case 20 |
| Two messages on one site at once | **one after the other** (the site lock) | the second waits and is re-sent | — | — | the poll says it is waiting | `site-busy.test.mjs` |

## 5. Proven capabilities (controlled reproductions, plus live runs where named)

- **A message's steps preserve each other's work.** The photograph taken off
  the home page came off the version the move had already rewritten; two
  look lanes in one message (stylesheet and description) are both stored;
  each page writer is handed only its own page and words (MW cases 2, 4, 7).
- **One publish per message** however many steps or kinds ran (every case);
  on the queue, the same outcome with sequenced reserves (case 6).
- **A new object is available to the steps after it in the same message** —
  on the add-on side: the function designer is shown the new table, the job
  designer the new function, every designer of a page's contents is told the
  page is being added, and the database is changed in that order (cases 14,
  15). The edit side creates no objects; its later steps see earlier pages
  and stored look values.
- **Independent edit steps survive a failed one**, and the failure is named
  with its cost (case 8); a refused rules step beside styling costs nothing
  (case 10).
- **What waits is named**: a held-back addition or styling change (cases 9
  and 11), a set-aside entry or menu link (case 16), additions past their
  limits (case 19).
- **Questions and their answers** (re-run, `live-clarify-continue`, 18
  declarations): the rest finishes beside a step's question; the answer
  resumes only that part; nothing completed is rerun or re-charged.
- **No two writes race**: within a message by construction (in turn), across
  messages by the site lock (`site-busy`, 19 declarations).
- **Live, already closed** (no rerun needed): two changes from one message on
  `fold-lane-bakery` — Test 6 (run 57: description and a Visit move), Test 7
  (run 60: a photograph's element off `/visit` and a home move), Test 8 (run
  66: a menu item out and a Visit move); five additions routed and delivered
  (run 92, Test 12).

## 6. Reproduced failures (each a case in `test/mixed-work.test.mjs`)

| ID | What happens | Where | Severity |
|---|---|---|---|
| **MW1** | Beside a look or page change, a **photograph change and a menu change are made but never told**. The merged answer flattens the steps into one object: `layers` lists every step (`["look", "picture", "nav"]`), but one `msg` survives (the picture's *"Took … off the page"*; the menu's own sentence is lost), and on a `look` answer both readers — the page's composer and `editReplyFacts` — read only the look's fields and the page operations, never `msg`, `photosTakenOff` or `links`. Same cause as review #9 / IL12, now shown for three- and four-step messages, on both paths. | the edit route's merge (`worker.js` after 26600); `editReply` in `chat.js`; `editReplyFacts` | high |
| **MW2** | A **fifth lane is dropped**: not run, not put off, not in `partial`, not in the reply. Which one goes is decided by `LANE_FIELDS` order (the menu, last, went). IL13 in a mix. | `laneList` (`site-lanes.mjs` 1690–1711) | high |
| **MW3** | **A second part the answer cannot make can vanish**: `alsoAsked` holds one passage, and nothing on the edit side checks that every part of the message went to a lane or was held. Shown with a picker that leaves a wording change unscoped; whether a real picker would hand it to a page lane is untested (real-model row MX5). | the router's `alsoAsked`; no coverage check after `pickLanes` | high (if a real picker leaves it) |
| **MW4** | **More changes of one kind than a step takes** lose the rest without a word: the ninth photograph (shown); by the code, the eleventh menu link, the twenty-first row change, the fifth rules table. IL14 in a mix. | the steps' own caps | high |
| **MW5** | **A QR code or a 3D scene that was added is never named** — alone (*"Done — updated /"*) or beside a page. The add-on's answer carries no field for either, so neither reader can say it. Nothing checks that the code was placed on a page either. | the add-on's answer; `addonReplyFacts`, `addonReplyText` | medium |
| **MW6** | **An addition's declined part vanishes** beside a part that was added. IL10 in a mix. | `aDeclined` read only when every kind declined | high |
| **MW7** | **A schedule faster than every 15 minutes is slowed without saying so**: the reply states fifteen as if asked. | two layers raise it, the add-on's cleaner (`everyAsked`, `site-add.mjs`) and `normalizeJob` (`site-jobs.mjs`); neither tells the reply | low |
| **MW8** | **The page's own reply names no page** for page steps alone (*"Updated the look."*), though the answer carries them. Only main's composer; a model reply's facts name both. | `editReply` in `chat.js` | low |

## 7. Not tested, said plainly

- **Real models.** Every case uses supplied answers. Whether the real router
  keeps four changes in one `look` answer, whether the real picker names four
  lanes with the right scopes, and what a real step does past its count, are
  §8's to measure.
- **A rules change beside other edits on a site with a database**, and **an
  address change beside other edits that succeeds**: the steps run (the
  probes show them reached and their refusals said), but their success in a
  mix is not driven here — the harness answers every site lookup with one
  owner, so the address step reads every name as taken.
- **The data step beside nothing else at its count** is covered by its own
  suites; beside other kinds the router holds it back, so it never meets
  another step in one message.
- **A logo beside other edits**: the router holds one back (a logo is its own
  layer); not driven.
- **Placement of a QR code by the real page writer**: with supplied pages the
  code is stored but on no page, and nothing reports that.
- **Wall-clock time of a four-step message on the queue**: unmeasured; the
  job's own budget (50 minutes in the container) bounds it.

## 8. The real-model batch (prepared, **not run**; needs your approval)

**What it adds.** The live matrix of deploy 2180
(`docs/history/2026-10-03-live-matrix.md`) already holds the edit-plus-
addition rows (H1–H4) and a question inside a mixed request (Q2), and closed
Tests 6–8 and 12 already hold two-change edits and single additions; none is
repeated. These rows measure what only real models can show: whether the
router keeps four kinds in one answer, which lanes and scopes the real picker
names, whether the real designers chain a table into a function and a job,
where the real page writer puts a QR code and a scene — and what the
customer is told each time.

**The sites as they are now** (read 2026-10-03, free: public pages, and
non-secret columns in Supabase):
- **`fold-lane-bakery`** ("Harbour Loaf") is at `01790923788063-bp9rcv`,
  Test 12's additions kept by your plan: its description *"Neighbourhood
  sourdough in Bristol…"*; the home and gallery menus *Today's bake, The
  starter, Visit, Gallery, Order* (the Visit and Order menus have no
  Gallery); the home page's starter story above its order band and the
  cooling-boule photograph; `/visit` with *"Come to the bakery"* above *"The
  shutters and the street"* and the order band, and the boule photograph
  added by Test 12. Its database link is set.
- **`repairbench-1`** ("Hebden Bike Repair", the add-on bench): pages `/`,
  `/status`, `/booking-check`, `/workshop-load`, `/rates`; its database link
  is set and it already runs jobs. **`fretwork-1` is not used**: its
  database link is blank, so an addition there would test the blank link
  (Lane 2's open decision), not mixed work.
- **Balance 137**, the ledger's last row 355, no job open (11:03 UTC).

**How each row is pressed**: the edit canary's one-message press, from
`main` (deploy 2180), one message per press; you press each, in order, and I
read each before the next. The boxes, by their descriptions:
- "Run the ONE paid edit as well (yes/no)": `yes`
- "What to change. REQUIRED when spend=1 …": the row's message, exactly
- "The site to edit …": the row's site
- "Refuse to spend unless the Worker reports this deploy sha …": `b8d12ff9`
- "Refuse to spend unless a cold container reports this image id …":
  `8bfc67dc695e65cc`
- "Refuse to post the paid edit unless the router answers this …": the
  row's route box (a different answer costs only its routing call)
- every other box blank.

The presses run main's code, so the replies are main's own composer (model
replies are on the branch, unmerged). Nothing is restored: each bakery row
runs on what the one before left, and the changes stay, as Test 12's did; a
free restore to `bp9rcv` is one press if you want it afterwards. No visitor
write is made (MX3's form is read, not submitted).

| Row | Site | Exact message | Route box | Passes when | Acceptable instead | Estimate |
|---|---|---|---|---|---|---|
| **MX1** four kinds across pages | `fold-lane-bakery` | Change our search description to "Overnight sourdough from a Bristol side street, ready to collect at the counter." Then take Gallery out of the menu, on the Visit page put the "Order a collection so we hold a loaf" band above "Come to the bakery", and take the photo of the cooling boule off the home page. | `intent=edit layer=look alsoAsked=none` | the description exact; Gallery out of the two menus that have it, the gallery page kept; the order band above *"Come to the bakery"* on `/visit`; the boule's element off the home page with no placeholder, **and its copy on `/visit` kept**; every other byte kept; one publish. The reply is recorded: MW1 predicts it names the description and `/visit`, not the photograph or the menu | a question, since every part names its page (a finding, recorded) | 7–12 (up to about 28 if the Visit move falls back to the full page writer) |
| **MX2** a fifth kind (optional, **pressed instead of MX1**) | `fold-lane-bakery` | Make the page background a warm cream. Change our search description to "Overnight sourdough from a Bristol side street, ready to collect at the counter." Then take Gallery out of the menu, on the Visit page put the "Order a collection so we hold a loaf" band above "Come to the bakery", and take the photo of the cooling boule off the home page. | `intent=edit layer=look alsoAsked=none` | a measurement: which lanes the real picker names; every change made is exact with everything else kept; whether the fifth is made, put off or said (MW2 predicts dropped and unsaid) | none needed: it records | 8–13 (the same tail as MX1) |
| **MX3** additions that depend on each other | `repairbench-1` | Add a callback request form to the Rates page asking for a name and a phone number, keep the requests in a list, and every morning at 7 mark any request older than a week as closed. | `intent=addon` | a table for the requests; a function that closes the week-old ones, reading that table; a daily job at 7 running that function; the form on `/rates` writing to the table; one migration, one publish, one charge; the reply names the table, the function, the job and the form. Read free afterwards: the table and function in the site's database, the job's registration, the `/rates` page | one question (what "closed" means, or what to collect); a refusal of the whole addition with its reason said is a finding (all or nothing), not a pass | 4–16 |
| **MX4** a wording change beside styling and a move | `fold-lane-bakery` (after MX1 or MX2) | Change "Come to the bakery" on the Visit page to "Find the bakery", make the headings dark green, and on the home page put the order band above the starter story. | `intent=edit layer=look` (either way below) | the headings dark green and the home move made; the wording made on `/visit` by its page step **or** named as left for the next message | either of those; **never** the wording neither made nor named (MW3) | 5–9 (up to about 47 if both page steps fall back to the full writer) |
| **MX5** a new page and its menu link (two presses) | `fold-lane-bakery` | 1. Add a page for our wholesale customers and put it in the menu. 2. (after reading 1) Put Wholesale in the menu. | 1. `intent=addon`; 2. `intent=addon` | 1: the page added and published, the menu link named as a separate step, nothing else changed; 2: the add-on hands the link to the menu step, and Wholesale is in every page's menu, nothing else changed | 1: one question about what the page should say | 11–19 for both |
| **MX6** a page with a scene, and a QR code to it elsewhere | `fold-lane-bakery` | Add a page about our oven with a 3D model of a bread oven on it, and a QR code on the home page that opens it. | `intent=addon` | the page with the scene on it, and the code **placed on the home page** opening it (untested in a controlled run, §7); one publish, one charge. The reply is recorded: MW5 predicts it names neither the code nor the scene | one question about what the page should say | 8–17 |

**Total: about 35–73 credits** if the page steps use the quick writer, as
they did in runs 57, 60 and 66; **at most about 127** if every page step
fell back to the full writer (each 6–22, runs 21–37) — under the balance of
137, which is the only bound (estimates, not caps). MX2 instead of MX1 adds
about 1. **Order**: MX3 any time (its own site); then MX1 or MX2, MX4, MX5's
two presses, MX6. **For each press I record**: the route and any held part;
the picker's lanes and scopes, or the add-on's kinds; each change against
the before-read; the publishes; the ledger rows and the balance; and the
customer-visible reply word for word. Nothing runs until you approve it.

## 9. The smallest grouped fixes, ranked by what they unlock

Each is small, uses the existing contracts, adds no layer, no keyword rule
and no fixed customer sentence, and keeps model-based routing.

1. **Every step reports what it did, and the reply reads every report**
   (MW1, MW5, MW6, MW8). The edit merge keeps each step's own account (a
   list, one entry a step) and `editReplyFacts` reads every entry; the
   add-on's answer names a QR code, a scene and every declined kind, and
   `addonReplyFacts` reads them. **Unlocks**: every multi-step message that
   already works becomes one the customer can trust — today three- and
   four-kind edits silently under-report. The largest gain for the least
   code.
2. **Nothing past a count is dropped without a word** (MW2, MW4). A fifth
   lane is put off through the existing held path (`deferred`), named for the
   next message, instead of discarded; the picture, menu, data and rules
   steps return what they left out, and the route lists it in `partial`.
   **Unlocks**: large requests degrade honestly; the customer can send the
   rest.
3. **Every part of the message is accounted for on the edit side** (MW3).
   The picker also lists the parts it could not place, in the customer's own
   words (a model judgement, like its scopes — no keyword rule), and the route
   puts them off or names them. **Unlocks**: wording, entries and additions
   mixed into a styling message are never lost; it pairs with the real-model
   row MX4.
4. **More than one part can be held back** (MW3's other half; part of the
   paused batch 2): `alsoAsked` as a list of passages, each checked against
   the message as the one is today.
5. **Say when a schedule is adjusted** (MW7): the job designer is told the
   minimum, and the reply says the platform's shortest interval was used.
6. **Your decisions, not fixes**:
   - **an addition with one refused part**: keep all-or-nothing (safe, and
     your 2026-09-13 rule: validate before anything is applied), or apply the
     independent parts and name the refused one;
   - **an edit and an addition in one message**: keep one route per message
     (today's rule: the other half is sent next), or let a message run both
     halves in turn — a second paid operation from one message, so only on
     your word;
   - **running steps at the same time**: keep "in turn" (your decision;
     safe), or run independent steps on different pages together — a
     redesign of the step loop and the publish, so only on your word.

**Next, separately**: the real-model batch above, on your approval; the
paused information-limits batches 2–4 (the pending request; operations and
results; the reply) — fixes 1, 2 and 4 above overlap batch 3 and batch 2 and
would be done once.

## 10. Checks run (all free)

- `test/mixed-work.test.mjs`: 20 cases, all passing as recorded (the
  findings asserted as they happen).
- Re-run as evidence: `live-clarify-continue`, `edit-removal-door`,
  `edit-page-once`, `edit-op-scope`, `handover-batch2`, `handover-route`,
  `site-busy`, `frame-addition`, `add-goes-to-addon` — 252 of 252.
- Mutation sweep over the new cases: 13 of 13 mutants caught, both
  comment-only controls left alone, every file restored by hash. Two of the
  13 put a finding's fix in place (MW1's step sentence read, MW5's QR code
  named), so each finding's case is shown to turn when its defect goes.
- Full suite `9090 / 9090 / 0 / 0` locally (from `9070` at `c088fc52`: the
  20 new cases exactly); unit CI `9090 / 9086 / 0 / 4` on `c5ecb081` (run
  37118809585; CI skips four). The record:
  `docs/history/2026-10-03-mixed-work-audit.md`.
- No model call, no paid run, no container rebuilt, nothing merged or
  deployed; Build untouched.
