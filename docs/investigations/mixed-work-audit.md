# Many changes from one message, across Edit and Add-on (audit and fixes, 2026-10-03)

> **Two orders, one report.** The audit (owner, 2026-10-03): *"Audit and test
> the existing implementation end to end, covering every supported edit
> operation and add-on kind … Distinguish clearly between several tasks
> completed from one user message, several model calls, and tasks actually
> running concurrently … This round is audit and testing only."* Then the
> fixes (owner, the same day): *"The mixed-work audit identifies the right
> problems, but correct its capability claims before proceeding … Separate
> what was actually changed and published from what was only designed,
> stored, handed off, deferred or left unverified. Remove “at most” language
> from cost estimates unless an enforced spending cap supports it. Keep the
> general information-limits batches paused … First implement the closely
> related mixed-work correctness fixes … Do not merge, deploy, rebuild
> containers, spend credits or run the prepared real-model batch yet."*
>
> **Where this stands.** The fixes are on `claude/help-needed-ehlwlj`,
> **unmerged and undeployed**: `main` (deploy 2180) still behaves as the
> audit found. No model was called, nothing was spent, no container was
> rebuilt, first Build is unchanged. **Every result below is a controlled
> reproduction** — the real routes, synchronously and as a queued job, with
> **supplied** model answers — unless it says "live". A controlled
> reproduction shows what the code does with an answer; it does not show that
> a real router, picker, designer or page writer gives that answer, nor that
> a live site receives the whole delivery. The real-model batch (§8) is what
> would show that, and it has not been run. The cross-route plan the order
> asked for is `docs/investigations/edit-addon-one-request-plan.md`.

## The answer, in plain English (corrected)

**What changes and publishes together from one message** (on this branch,
shown with supplied answers):
- **Edits of every kind the look door reaches, as many as the picker names**,
  one after another, published once: the stylesheet, theme, name,
  description, logo and tab icon, sections moved or taken off on any page, a
  photograph swapped, reframed or taken off, the menu and the header button,
  who may submit what, the web address. The four-kind limit is gone; five
  different kinds ran together, stored and queued (FIXED MW2).
- **The same kind of change on several pages or targets**: two sections on
  two pages; the wording on several pages (one text step); nine photographs
  (every one asked, FIXED MW4); row changes, rules for several tables and
  link changes past their old counts (shown at each step's reader).
- **Additions designed and applied together**: ten of the twelve registered
  kinds — `table`, `function`, `api`, `job`, `page`, `component`, `words`,
  `qr`, `three`, `photo` — in a fixed order, so a function can read a table
  added in the same message and a job can run that function; one migration,
  one page write, one publish, one charge. **`row` and `frame` are the
  exceptions**: beside any other kind they are **set aside and named, not
  made**; alone, a row is added by the add-on step and a menu link (`frame`)
  is handed to the menu step.

**What is only stored, handed off or left for later, and now said as such**:
- **A QR code or a 3D scene is stored configuration.** The add-on saves it
  and hands it to the page writer; whether a page shows it is now read from
  the published pages, and the reply says *shown on /x* only when a page
  does, otherwise *saved, but no page shows it yet* (FIXED MW5). That a
  **real** page writer places it on the page asked for is **unverified**.
- **A part no single route can make with the rest is left for later and
  named**, in the customer's words — now several parts, not one: the
  router's held parts (a list on a site) and each part the picker names as
  no lane's here (FIXED MW3). They are never run this turn.
- **An addition whose designer declines** is named as not made beside the
  ones that were (FIXED MW6); **a schedule faster than every 15 minutes**
  runs every 15 and the reply says what was asked, what runs and why (FIXED
  MW7).

**What still stops more**:
1. **An edit and an addition never finish together.** One message reaches
   one route; the other half is left for later, named, and must be sent
   again. The smallest change that would finish both halves in the same
   request is proposed in the plan (revised 2026-10-03 around the server's
   job runner; not built; nine decisions are yours).
2. **The fixes depend on the models answering as told.** A picker that names
   no lane and no `elsewhere` for a part leaves the code nothing to read, and
   nothing here guesses at it (no keyword rules). Only the real-model batch
   can measure how often that happens.
3. **Genuine limits remain, each now named when it binds**: per-kind
   addition ceilings (§2); one answer per step, refused whole when it is cut
   off at its ceiling; what one request can carry (48,000 characters); the
   information limits on what each step is shown (60 rows, 60 photograph
   slots), which belong to the paused information-limits batches. **The
   menu's ten items and each footer list's eight are gone** (2026-10-03, on
   your review). Neither was a technical constraint: the kit renders every
   item. The eight cut a ninth small-print link before any entry was read,
   and said nothing.
4. **Nothing runs at the same time**, by your decision: steps run in turn, a
   site runs one job at a time, and a big message takes the sum of its
   steps' time.

## 1. Three things that are easy to confuse

| | What it means here | On this branch |
|---|---|---|
| **Several tasks from one message** | the customer asks for several changes in one message and the builder makes them all before answering | yes, within one route: every edit lane the picker names (each on as many pages as it touches), or up to the ten addition kinds that combine; never an edit and an addition together |
| **Several model calls** | one task, or one message, uses more than one model call | always: the router (1), then for an edit the lane picker (1) and one call per lane or step (a page step may add a keep check, a full-writer fallback or a stylesheet correction); for an addition the add-on picker (1), one designer per kind and one page writer; and a reply writer when replies are model-written |
| **Tasks running concurrently** | two of the customer's changes being made at the same moment | **never.** Lanes and steps run in turn ("RUN EVERY STEP IN TURN, AND ANSWER ONCE": two rungs at once would race over the same config and page source), designers run in turn, and one job runs per site (the site lock). Only infrastructure overlaps: store reads, an addition's photographs bought together, translations of one publish, different sites |

## 2. What is registered, and the limits that remain

**Edit layers** (`EDIT_LAYERS`), one per message from the router: `data`,
`text`, `look`, `page`, `rules`, `picture`, `logo`, `nav`, `rename`.

**Look lanes** (`LANE_FIELDS`): 21, **every one the picker names runs**
(the four-lane cap `MAX_LANES` is removed). Where each lane's work runs:

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

**Add-on kinds** (`ADD_KINDS`): `table`, `row`, `function`, `api`, `job`,
`page`, `component`, `words`, `frame`, `qr`, `three`, `photo`, designed in
that order. `frame` alone is handed to the menu step; `row` and `frame`
beside other kinds are set aside and named.

**Counts removed** (each was a silent drop): lanes per message (4),
photographs per picture step (8), row changes per data step (20), tables per
rules step (4), link changes per menu step (12), parts put off per request (4,
now bounded by what one request carries), and the schema `maxItems` on the
nine list-kind addition tools (which told a model to leave entries out
before the cleaner could name them). **And, on your review (2026-10-03), the
menu's items (10, `MAX_NAV_ITEMS`) and each footer list's entries (8,
`MAX_LIST_ITEMS`)**, in the reader and in the add-on's frame hand-off:
- the footer's count cut the list before any entry was read
  (`raw2.slice(0, MAX_LIST_ITEMS)`), so a ninth valid entry vanished with
  `dropped: []`;
- the menu's count was named when it bound, but it was a design number, not
  a constraint (the kit renders every item).

What bounds a menu or footer list now:
- the step's answer ceiling (`navMaxTokens`), with a cut answer refused
  whole;
- each label's length (`MAX_LABEL`, 40, an information limit left for the
  paused batches);
- each entry's destination, checked one by one, with every refused entry
  named with its own reason (`docs/history/2026-10-03-footer-lists.md`).

**Limits kept, each named when it binds**:

| Limit | Value | Why it stays | What the customer is told |
|---|---|---|---|
| Additions of one kind per message | pages 6 (the page writer's own), components 12, tables 6, rows 12, functions 6, APIs 4, jobs 4 (the engine keeps 8 per site), lines of words 6, photographs 6 (`IMAGE_CAP`, the purchase ceiling) | ceilings a site can hold, set by the owner's "no low limits while testing" | every entry past it, by name (`over-cap`) |
| One step's answer | its ceiling grows with what the step is shown, enforced at most 16,000 tokens (`LIST_ANSWER_MAX_TOKENS`, inside the call's time limit) | the time a call may take | an answer cut off at its ceiling is refused whole: *"The builder's answer for that part was cut off before it finished, so none of it was used and nothing there changed — this is on us."* |
| Parts carried across turns | 48,000 characters together (`MAX_CARRIED_CHARS`), each part one message (16,000) | the size policy | a list past it is refused whole at no cost, never run whole |
| A scheduled job's interval | at least every 15 minutes | the platform's own minimum | what was asked, what runs, and why |
| Rows shown to the data step; photograph slots shown to the picture step | 60 each | information limits: the paused batches | unchanged by this round |

## 3. How a mixed message flows (on this branch)

1. **The router gives one answer for the whole message**: an intent and, for
   an edit, one layer. A part no single answer can make with the rest is held
   back (`alsoAsked`: on a site, a list of passages, each copied from the
   message; the first build's tool is unchanged and keeps its one string).
2. **On an edit**, the picker names the lanes and, for each change, its own
   page and words (`scopes`), and **each part of the message no lane here can
   make** (`elsewhere`, copied exactly; a part the message does not hold
   word for word is dropped and counted, never put off on a guess). Every
   part put off — the router's, the picker's, an addition found by the look
   door — is taken out of every step's words before anything runs.
3. **Steps run in turn**; each later step works on the pages the earlier ones
   produced. **Each step's own result is kept** (`steps` on the answer: its
   layer, lanes, status — done, asked, failed or superseded — its target
   (its words, and its page on the page rung), its own account and its cost),
   through the merge, the queue's stored reply and the reply.
4. **One publish** for the whole message, only if something succeeded.
5. **Every part not done is named with its target** (`partial`: the step's
   words or the part of the site its lanes are, the page on the page rung,
   the builder's own reason, `truncated` when its answer was cut off, and
   what it still cost); a change withheld for a page the site does not have
   keeps the words it was for, so a question beside it can take them out of
   what its answer resumes.
6. **On an addition**, the add-on picker names the kinds; one designer per
   kind runs in order, each shown what the ones before proposed; everything
   is validated before anything is applied (one refusal refuses the whole
   addition); then one migration, the jobs registered, one page write, one
   publish, one charge. **The answer now keeps** each declined kind
   (`declined`), each QR code with the page asked for and the pages that
   really show it (`qrs[].on`, read from the publication), the scene likewise
   (`scene.on`), each job's interval asked beside the one applied
   (`askedEveryMinutes`), and every entry of every list (nothing cut at six).
7. **The reply**: model-written from the answer's facts (`MODEL_REPLIES`), and
   the page's own composer as the fallback; both read the same new fields
   (screenshots: the round's history file).

## 4. Outcomes, by what really happened

The words used below, as the order asked:

| Outcome | Means |
|---|---|
| **Changed and published** | the stored site changed (pages, look, database) and the one publish carried it — read back from the stored pages and the compiler's payload |
| **Designed** | a designer proposed it; nothing is applied until every part passes validation |
| **Stored** | saved in the site's configuration (a QR code, a scene's description) — not by itself on any page |
| **Handed off** | passed to another step within the same message (the add-on's lone menu link to the menu step; a QR code's placement to a page step) |
| **Left for later** | not run this turn; named, in the customer's words, for them to send |
| **Unverified** | not shown by anything in this round: real-model answers, a real page writer's placement, live delivery |

## 5. The capability matrix (this branch; controlled unless marked live)

"In turn" = run one after another within one message; nothing runs at the
same time. Evidence: **MW** = `test/mixed-work.test.mjs`; **live** = a closed
live test.

| Combination | Outcome | How it runs | Publishes · charges | What the customer is told | Evidence |
|---|---|---|---|---|---|
| The same layout change on two pages | changed and published | two page steps in turn, each on its own page and words | 1 · one per page step | *"Updated / and /visit."* (FIXED MW8) | MW |
| Wording on several pages | changed and published | one text step | 1 · 1 | both changes quoted | MW |
| Nine photographs off one page | changed and published, all nine | one picture step | 1 · 1 | every photograph named (FIXED MW4) | MW, sync and queued |
| Menu items past ten | the first ten changed and published; the rest left out | one menu step | 1 · 1 | each item past ten named, with the limit | `site-nav` |
| Row changes, rules tables, link changes past their old counts | read whole by each step's reader | one step each | — | — | `site-apply`, `site-rules`, `site-nav` (readers; not through the route here) |
| Three kinds on one page (a move, a photo off, the menu) | changed and published | page, picture, menu steps in turn | 1 · 3 | the page, the photograph and the menu, each in its own words (FIXED MW1) | MW |
| Four kinds across pages | changed and published | look, page, picture, menu steps in turn | 1 · 4 | all four (FIXED MW1) | MW, sync and queued |
| Five kinds | changed and published | four steps (two lanes share the look step) | 1 · 4 | all five (FIXED MW2) | MW, sync and queued |
| Two changes across pages (description + Visit move; photo off + home move; menu + Visit move) | changed and published | as above | 1 · 2 | named | **live**: Tests 6, 7, 8 (runs 57, 60, 66), on `main`'s code |
| One step fails beside others | the rest changed and published; the failure named with its target and cost | in turn | 1 · each step that called its model | *"⚠️ “take Gallery out of the menu”: I couldn't work out what the menu should be. … That part still cost 1 credit."* | MW |
| One step asks beside others | the rest changed and published; the question kept for that part only | in turn | 1 · the steps that ran | the question under the rest; each step's status kept | MW, sync and queued |
| A step's answer cut off at its ceiling | that part not changed; the rest published | refused whole | 1 · the steps that ran | the cut part said as unchanged, ours | MW, sync and queued |
| An edit and an addition | **the addition left for later** | the router answers the edit | 1 · the edit | *"Say “…” and I'll do that next."* | MW |
| Two parts no single answer can make (an addition and a wording change) | both left for later, both named | the router holds one, the picker names the other | 1 · the rest | both named (FIXED MW3) | MW, sync and queued |
| Every part named as another step's | nothing changed, nothing billed | — | 0 · 0 | each part named as left for later | MW, sync and queued |
| A table, a function that reads it, an API and a job that runs it | designed, then changed and published | in dependency order | 1 · 1 | all four named | MW |
| A new page, a component, words, a QR code and a scene on it | the page, component and words changed and published; **the QR code and scene stored**, on no written page | in order, one page write | 1 · 1 | the code and scene said as *saved, but no page shows it yet* (FIXED MW5) | MW |
| The same, when the writer draws them | the QR code and scene changed and published, each on its page | as above | 1 · 1 | *"added a QR code captioned “Wholesale” on /, added a 3D scene on /wholesale"* | MW |
| A new page and a menu link, or a new list entry | the page changed and published; **the link or entry set aside** | — | 1 · 1 | named as a separate step | MW |
| One addition's designer declines | the rest changed and published; **the declined kind named as not made** | — | 1 · 1 | (FIXED MW6) | MW |
| One addition fails its checks | nothing (all or nothing), the reason said | validation before any apply | 0 · 0 | the reason, "Nothing was changed" | MW |
| More additions of one kind than allowed | up to the ceiling changed and published; every one past it named | — | 1 · 1 | *"I left out “…”"* | MW, `site-add` |
| A schedule faster than every 15 minutes | changed, running every 15 | — | 1 · 1 | what was asked, what runs, why (FIXED MW7) | MW |
| Two messages on one site at once | one after the other (the site lock) | the second waits | — | the poll says it is waiting | `site-busy` |

## 6. The findings and what became of them

| ID | What the audit found (on `main`) | On this branch | How it is shown |
|---|---|---|---|
| **MW1** | a photograph and a menu change made beside a look or page change, and told nowhere | every step's own result kept (`steps`) through the merge, the queue and both replies | MW three- and four-kind cases, sync and queued |
| **MW2** | a fifth lane dropped without a word | no lane cap; every lane named runs | MW five-kind case, sync and queued; `edit-lanes` |
| **MW3** | a second part the answer could not make vanished | several held parts (the router's list) and the picker's `elsewhere`, each checked against the message, taken out before anything runs, and named | MW cases, sync and queued; `edit-lanes`, `site-ask`, `route-decision`, `handover-*` |
| **MW4** | a ninth photograph (and by the code an eleventh link, a twenty-first row, a fifth rules table) dropped without a word | no counts; each step's answer bounded by its ceiling and refused whole when cut | MW nine-photograph case, sync and queued; the four readers' tests |
| **MW5** | a QR code or scene added and never named; placement never checked | placement read from the publication; *shown on* only when shown, *saved, not shown* otherwise | MW placed and unplaced cases |
| **MW6** | a declined addition vanished beside one added | `declined` on the answer and in both replies | MW case |
| **MW7** | a schedule slowed to 15 minutes without saying so | asked and applied both kept and explained | MW cases (adjusted and not) |
| **MW8** | the page's own reply named no page | the look branch names its pages ("Updated / and /visit.") | MW case; the page-step suites |

Also in this round: a part not done is led by its target (its words, the part
of the site its lanes are, or its page) instead of a count, in the facts and
on the page; a page is reported as a step's target only on the page rung (a
photograph or the menu works across the site); and entries past an addition's
ceiling are named by what they are (a line of words by its words, a
photograph by what it shows).

## 7. Unverified, said plainly

- **Real models.** Every case uses supplied answers. Whether the real picker
  uses `elsewhere`, names five lanes with the right scopes, or answers a
  router list; whether the real designers chain dependent additions; whether
  a real page writer places a QR code and a scene where asked — §8's to
  measure.
- **Live delivery.** Nothing of this round is deployed; no live site has
  shown any of it.
- **Through the route**: row changes, rules tables and link changes past
  their old counts are shown at their readers only; a rules change and a
  successful address change beside other edits are not driven in a mix (the
  harness answers every site lookup with one owner).
- **Wall-clock time** of a many-step message on the queue: unmeasured; the
  job's own budget (50 minutes in the container) bounds it.

## 8. The real-model batch (prepared, **not run**; needs your approval)

**What it adds.** Closed Tests 6–8 and 12 and deploy 2180's live matrix
(H1–H4, Q2) are not repeated. These rows measure what only real models can
show, and what the customer is told.

**Which code it runs.** The presses run the code deployed when they are
pressed. On `main` today (deploy 2180) the audit's findings hold, so each
row's reply prediction is the finding's; if this branch is merged and
deployed first, the same rows check the fixes instead — noted per row. The
sha and image boxes must be re-read at press time.

**The sites** (read 2026-10-03, free): `fold-lane-bakery` at
`01790923788063-bp9rcv` (Test 12's additions kept); `repairbench-1` (pages
`/`, `/status`, `/booking-check`, `/workshop-load`, `/rates`; database set;
runs jobs). `fretwork-1` is not used (its database link is blank). Balance
137, ledger row 355, no job open (11:03 UTC).

**How each row is pressed**: the edit canary's one-message press; you press
each in order and I read each before the next. Boxes by description: "Run
the ONE paid edit as well (yes/no)": `yes`; "What to change …": the row's
message exactly; "The site to edit …": the row's site; the sha and image
boxes: as deployed when pressed; "Refuse to post the paid edit unless the
router answers this …": the row's route box; every other box blank.

| Row | Site | Exact message | Route box | Passes when | On `main` the reply is predicted to | On this branch, merged and deployed, it is predicted to | Estimate |
|---|---|---|---|---|---|---|---|
| **MX1** four kinds | `fold-lane-bakery` | Change our search description to "Overnight sourdough from a Bristol side street, ready to collect at the counter." Then take Gallery out of the menu, on the Visit page put the "Order a collection so we hold a loaf" band above "Come to the bakery", and take the photo of the cooling boule off the home page. | `intent=edit layer=look alsoAsked=none` | the description exact; Gallery out of the menus that have it, the page kept; the band moved on `/visit`; the boule's element off the home page with no placeholder and its copy on `/visit` kept; every other byte kept; one publish | name the description and `/visit` only (MW1) | name all four | about 7–12; about 28 if the Visit move falls back to the full page writer |
| **MX2** five kinds (instead of MX1) | `fold-lane-bakery` | Make the page background a warm cream. Change our search description to "Overnight sourdough from a Bristol side street, ready to collect at the counter." Then take Gallery out of the menu, on the Visit page put the "Order a collection so we hold a loaf" band above "Come to the bakery", and take the photo of the cooling boule off the home page. | `intent=edit layer=look alsoAsked=none` | a measurement: which lanes the real picker names; every change made exact, everything else kept | drop the fifth, unsaid (MW2) | run and name all five | about 8–13; the same full-writer case as MX1 |
| **MX3** dependent additions | `repairbench-1` | Add a callback request form to the Rates page asking for a name and a phone number, keep the requests in a list, and every morning at 7 mark any request older than a week as closed. | `intent=addon` | a table; a function closing week-old requests, reading it; a daily job at 7 running it; the form on `/rates` writing to the table; one migration, one publish, one charge; all named | the same | the same | about 4–16 |
| **MX4** wording beside styling and a move | `fold-lane-bakery` (after MX1 or MX2) | Change "Come to the bakery" on the Visit page to "Find the bakery", make the headings dark green, and on the home page put the order band above the starter story. | `intent=edit layer=look` | the headings and the home move made; the wording made on `/visit` **or** named as left for later; **never** neither | possibly neither made nor named (MW3) | made, or named as left for later (`elsewhere`) | about 5–9; about 47 if both page steps fall back to the full writer |
| **MX5** a page and its menu link (two presses) | `fold-lane-bakery` | 1. Add a page for our wholesale customers and put it in the menu. 2. (after reading 1) Put Wholesale in the menu. | `intent=addon` both | 1: the page added, the link named as a separate step; 2: the link handed to the menu step and in every menu | the same | the same (the plan would make the second press unnecessary) | about 11–19 for both |
| **MX6** a page with a scene, and a QR code to it | `fold-lane-bakery` | Add a page about our oven with a 3D model of a bread oven on it, and a QR code on the home page that opens it. | `intent=addon` | the page with the scene, and the code **shown on the home page** opening it; one publish, one charge | name neither (MW5) | say each as shown, or as saved and not shown, as the publication reads | about 8–17 |

**Total: about 35–73 credits** if the page steps use the quick writer, as
they did in runs 57, 60 and 66; **about 127** if every page step fell back to
the full writer (each 6–22, runs 21–37). These are estimates, not caps:
nothing enforces a per-request limit, and the balance of 137 is the only
bound. MX2 instead of MX1 adds about 1. **Order**: MX3 any time; then MX1 or
MX2, MX4, MX5's two presses, MX6. For each press I record the route and any
held part, the picker's lanes, scopes and `elsewhere` (or the add-on's
kinds), each change against the before-read, the publishes, the ledger rows
and the balance, and the customer-visible reply word for word.

## 9. What is left, and what is yours to decide

- **Finishing both halves in one request**: the plan, revised 2026-10-03 on
  your review (`docs/investigations/edit-addon-one-request-plan.md`). The
  first version's browser-driven chain is gone.
  - An accepted message becomes one **request** on the server.
  - Each of its parts runs as ordinary queued jobs, filed under keys derived
    from the request, through the existing runner (claim, lease, site lock,
    reserves, publish marks, sweeps, reconcile).
  - A driver files the next runnable part after each job ends. The
    two-minute cron is what guarantees it.
  - The model names which parts need which, and code enforces the order.
  - The browser only follows and answers questions.
  - **Your decisions first** (D1–D9 in the plan): among them, whether later
    parts may spend without a second press, the failure policy (B proposed:
    stop only what depends on a failure), and one reply per part or a
    summary.
- **An addition with one refused part**: keep all-or-nothing (your
  2026-09-13 rule) or apply the independent parts and name the refused one.
- **Running steps at the same time**: keep "in turn" (your decision), or a
  redesign of the step loop and the publish, only on your word.
- **The per-kind addition ceilings** (§2): kept and named; raising or
  removing any is your call.
- **The paused information-limits batches** stay paused.

## 10. Checks run (all free)

Recorded in `docs/history/2026-10-03-mixed-work-fixes.md`, with the screenshots.
