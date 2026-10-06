# The add-on path: what it adds, what it reports, what it knows

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). The add step's kinds,
> the requirement report and what it refuses to claim, run 53, what the add-on
> is told about the site, photographs, QR codes and scenes, and outside
> connections a page can render. The short summary
> and the per-kind capability table, which CLAUDE.md kept, moved here in the
> second pass (`git show 28bdc97f:CLAUDE.md`) and are the first two sections
> below. `docs/addon-capabilities.md` and
> `docs/addon-runbook.md` are older companion documents.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

### The add-on path, in brief

The full law is `docs/addon-path.md`. **"Add" always goes to the add-on step;
an edit changes what already exists.** `builder/site-add.mjs` runs `pick_adds`,
then one call per kind in run order — `table · row · function · api · job · page ·
component · words · qr · three · photo` (`MAX_ADDS` 12; `words` on the branch,
below), with `frame` handed to the menu editor — then one publish; the first
backend kind on a site with none makes its database (`ensureSiteBackend`). An
addition is always a new thing: every page it changed must still say every word
it said (`keptProse`, else 422 `rewrote` at no cost), and a second one copies
the first's design. The designer's raw reply is kept at
`source/<slug>/addon-answer.json`. A job or an internal function alone changes
no page (`pageless`, 2 credits measured). Requirements ride beside the design
(`builder/site-requirements.mjs`, seven states from `delivered` to `failed`);
nothing exercises a behaviour, so `configured` is as far as a claim can get,
and nothing is called missing unless every reader that could speak has spoken.
The render check will not fake an outside dependency (`apiAnswer`: 424 `unmet`,
not serious). A photograph placed in the same request is bought after the merge
and billed on what was made (~18.75 credits each); a `src` the site does not
own never ships; a QR code pointing at a page that did not survive is withheld
together with everything that renders it. Outside connections carry `returns`,
typed `params` and `credential` (`site-api-shape.mjs`), none of them in the
cache key. Which kinds have been proven live is the table under *What is proven
live*, below. **One more entry in a list the site already stores is `row`**
(2026-10-01; merged and deployed in deploy 2175, not yet shown live): asked
alone it is written with the
data step's own parameterised insert, beside the request's key in one
statement, with no page call and no publish; beside other kinds it is set
aside and named (*THE `row` KIND*, below).

**An addition that is one part of a longer message** (2026-10-03, on the
branch, off by default behind `REQUEST_FLOW`) runs as its own queued job,
in the order the model gave. The edit step's hand-over to the add-on, and
the add-on's hand-over of a menu link to the menu step, are made by the
server instead of the page. How it works: `docs/request-flow.md`.

## What is proven live, per addon kind

**IMPLEMENTED-BUT-UNVERIFIED IS NOT UNSUPPORTED, and the two are kept apart
because their next steps are different**: one is waiting on a press or a
credential and its next step is a MEASUREMENT; the other has no code behind it
and its next step is a CHANGE.

| kind | live proof | not established |
|---|---|---|
| `table` | runs 30–34, 46, 47 | a table with no writer is REPORTED, not refused |
| `function` | runs 30–34, 47, 49, 50, 52 (a stored internal one reused) | no live run has exercised a `plpgsql` body |
| `api` | **RUN 53 — a published page READ THE REAL SERVICE AND RENDERED ITS DATA**: `/rates` on `repairbench-1` serves `1.1644 / 1.3344 / Rates from 2026-09-18`, which is the keyless rates service's own answer (`{"base":"GBP","date":"2026-09-18","rates":{"EUR":1.1644,"USD":1.3344}}`), read at two depths, zero console errors | a page reading a **keyed** connection, and whether a wrong key surfaces usefully |
| `job` | 50 registered a recurring one and Run now answered `3`; 52 a one-time one | **automatic execution on a real tick**, and **any message actually delivered** |
| `page` | 47 `/status`, 48 `/booking-check`, 49 `/workshop-load`, 51 `/gallery` | — |
| `component` | runs 21–23, 35, 36, 37 | the ONE kind off `APPLIED_KINDS`, so absence is never reportable |
| `qr` | 51 published `qr-gallery.svg` and **the served file re-encodes to `/gallery`** | nothing has ever scanned one |
| `three` | **measured live today**: `fretwork-1` and `ashgrove-1` each serve a `@react-three/fiber` canvas | **which PATH made it** — `three` is a dispatched EDIT lane as well as an addon kind, so a probe of the document cannot say |
| `photo` | **NONE.** Run 51 reached the provider and was **refused** | **the whole kind**, parked on fal funding |
| `frame` (2026-10-02, on the branch) | **NONE** — supplied answers only | a real router and menu editor handing a new menu link, footer link or header button over as an addition (*Test 12*) |
| `words` (2026-10-02, on the branch) | **NONE** — supplied answers only | a real page writer placing one line, found on its page before the bill (*Test 12*) |
| `photo`, one of the site's own (2026-10-02, on the branch) | **NONE** — supplied answers only | a real designer choosing a photograph the site already shows, placed by its exact address (*Test 12*) |
| `row` | **RUN 88 (Test 11, 2026-10-01)**: after the router fix (deploy 2177) the route answered `addon` for *Add one loaf to today's loaves: …* (the route's answer, not proof of the raw model's choice: its reply cannot show a conversion, `docs/investigations/router-audit.md` R3), and the step (kinds exactly `row`) saved one entry, `loaves` id 7 "Rye & Caraway", read back whole: the six existing rows unchanged, no page published, cost 2 (routing 3) | several entries in one message, other lists and phrasings, an entry beside other kinds (set aside by design), a list whose page filters or caps what it shows |

**Eight of nine have landed their own work on a real site. The ninth has not,
and its blocker is a balance rather than code.** The tenth, `row`, is new
(2026-10-01) and landed its first entry on a real site in run 88 (Test 11).

**AND THE BACKEND TIER HAS NO CORPUS, which bounds what can be claimed.** The
100-site corpus is **324 `.tsx` files with ZERO `useRows`, ZERO `useCreateRow`,
ZERO `useApi`, ZERO `useRpc` and ZERO `useUploadFile`** — it is a FRONTEND
corpus, because a first build is frontend-only by default. So the false-alarm
measurements this file leans on (the kit closure's 9–53 files, the 322-against-
222 lint reading, the 320 picture frames) are all statements about the frontend.

**WHAT ONLY WORKS IN COMBINATION**, each measured:

- **A VISITOR MAY SEND A PICTURE AND NOTHING ELSE; AN OWNER MAY SEND A
  DOCUMENT.** `handleVisitorUpload` takes PNG/JPEG/WebP/GIF by magic number,
  2 MB, throttled, SVG refused as stored XSS — while an OWNER's upload also
  takes **PDF and the zip family** (`sniffUpload`, `MAX_DOC_BYTES` 10 MB). So
  *"put our menu PDF up"* works and *"let customers attach a receipt PDF"* does
  not, and they are different questions about different routes.
- **⚠ "`uploadFile` IS IN ZERO PROMPTS" IS FALSIFIED.** That grep used the
  bare function name; **the kit exports TWO things and the prompts name the
  other** — `useUploadFile` occurs **6 times in `builder/page-gen.mjs`**, and
  the chain is whole at every hop: page rule 8 carries a worked example,
  `schemaDigest` states `FILE UPLOAD: YES/NO` per table and NAMES the column,
  the table tool tells the designer what to call it, and a lint refuses
  `useUploadFile` on a table that takes none. *A grep for the wrong identifier
  reads exactly like a missing wire* — and it was recorded as one for four days.
- **WHAT IS REALLY LEFT THERE IS ONE LINE AND IT IS OWNER-GATED.**
  `isImageColumn` answers NO to `attachment · file · upload · receipt ·
  document · screenshot · artwork`, so a designer that ignores the naming
  guidance produces a form with no attach control. **Widening the list widens an
  endpoint that is UNAUTHENTICATED by design**, which is the owner's call.
- **Video and audio EMBED; they do not HOST.** `video-embed`, `video-player`,
  `video-hero`, `audio-player` and `audio-recorder` are all in `COMPONENT_MENU`
  and all make **zero network calls**, so a `component` ask places one around a
  URL the owner supplies. **Neither sniffer admits a video or audio container**,
  so a media file has no home here — which also means a `/u/` media url can only
  be one a model invented, and the stray wall empties it correctly. **The
  reachable half of that wall is the PDF**, which really can be uploaded.
- **`pageless` is job + INTERNAL function only** — driven.
- **CREDENTIAL-SOURCE GUIDANCE EXISTS, CONDITIONAL ON THE METADATA BEING
  SUPPLIED** (moved here 2026-09-20; it had been filed as *"names no sign-up
  page"*). `cleanCredential` (`site-api-shape.mjs`) stores
  **`{service, url|signup, note}`** — WHICH service, its SIGN-UP PAGE, and a
  free-text note, which is where *"the free tier is enough"* belongs. The url
  is **https-validated** and refused as `credential-url` otherwise
  (*"The sign-up page for that service has to be an https address"*), and an
  unreadable object is `credential-shape`, whose sentence asks the customer to
  NAME THE SERVICE. `credentialNote` reads it **PER CONNECTION**, so a mixed
  request cannot tell the owner to sign up for a key nothing will use.
  **THE CONDITION IS THE WHOLE OF IT, AND IT IS A REAL LIMIT**: every part is
  optional, `cleanCredential` answers `null` when all three are absent, and
  **nothing compels the designer to fill them** — so the guidance is present
  when the declaration carries it and silent when it does not. That is
  different from *"no sign-up page exists"*, which is what the old entry said.
  What stays true: **misleading metadata on a KEYLESS connection is ignored
  rather than believed**, and the note never claims a service *"is answering
  already"* — this platform has not called it and has no business saying so.
- **A FUNCTION CHOOSES ITS OWN `language`, AND THIS SAT IN THE UNSUPPORTED LIST
  FOR A DAY AFTER IT SHIPPED** (closed 2026-09-19, moved here 2026-09-20).
  `FN_LANGUAGES` is `["sql", "plpgsql"]` beside the emitter, `fnLanguage` is the
  ONE reader (`site-rls.mjs:932`, emitted at `site-schema.mjs:742`), the tool's
  enum is DERIVED from it, `cleanAdd` refuses `bad-language`
  (`site-add.mjs:2491`), and the **fold** — a third hop nothing had found,
  because `foldAdds` REBUILDS the item too — is SUBTRACTIVE. Proven on a real
  PostgreSQL 16: the same body declared `sql` is REFUSED, created as plpgsql it
  ANSWERS, `pg_proc` agrees, and **SECURITY DEFINER and `search_path = public,
  pg_temp` both survive**. **`job` is still additive and is NAMED in the code as
  the remaining instance of that class.**
  **THE SHAPE OF THE MISTAKE IS THE POINT**: the entry carried its own
  `CLOSED 2026-09-19` in the body while its HEADING still read *"cannot choose
  its language"*, and a heading is what anybody skimming a capability list
  reads. **An entry that closes must MOVE, not gain a sentence** — a closed
  limitation left in a limitations list is a false negative about our own
  product, and it survived a session that quoted the list back out loud.

**UNSUPPORTED, and the honest reason for each:**

- **Nothing adds a row to a table the site already has** (traced 2026-10-01,
  Test 11). `table`'s `seed` is starter rows for a new table, and
  `seedSiteRows` skips any table that already has rows, so "add one item to
  the list" is refused, or publishes a hand-written card while the list is
  unchanged (rehearsed with supplied answers). The only row insert is the
  edit side's data step, which an addition does not reach.
- **Nothing deletes a table, a saved function, a connection or a scheduled job**
  — `NOT_REMOVABLE` is `backend · lang · slug · kind · purpose`. **SIXTEEN**
  lanes ARE removable (`components` and `tsx` among them) and `PAGE_VERBS` is
  `add · remove · move`, so "nothing deletes" is only true of the backend.
*(The api tier's `credential` used to sit here as "names no sign-up page". It
does name one — moved up to the supported list on 2026-09-20.)*

---

### THE `row` KIND: ONE MORE ENTRY IN A LIST THE SITE ALREADY STORES (2026-10-01, deploy 2175)

The owner's rule is *"Add will always go in addon"*, and until this kind no
add-on kind could add a row to a table the site already has (Test 11's trace,
`docs/history/2026-10-01-add-row-prep.md`). Built on the owner's word;
`docs/history/2026-10-01-add-row.md` has the story and the evidence.

- **Which lists**: `rowTables(spec)` — every stored table whose access is the
  DISPLAY preset, asked of `resolveAccess` against `ACCESS_PRESETS.display`,
  exactly as the data step asks it. A table visitors send in, a members'
  table, and a public table visitors write (a guestbook) take no entry.
- **Which values**: the data step's own rule, now shared (`rowValues` in
  `builder/site-rows.mjs`): a declared column, a scalar or `null`, a string
  cut to 2,000 characters; `id` and `created_at` are always the database's.
  Refused by name, at no cost: no list named (`no-row-table`), a list the
  site does not store (`row-no-table`), a list that is not a display list
  (`row-not-list`), nothing left to write (`row-no-values`). Up to
  `MAX_ADD_ROWS` (12) entries per message; one refused entry beside a good
  one is named, not fatal.
- **The write**: the data step's own `insertStatement` (shared, not copied),
  each entry `RETURNING *`, all of them and a `_meta` row keyed by the
  request (`addon-row:job:<id>` under a job, `addon-row:idem:<key>` inline)
  in ONE statement (`rowsInsert`). A second run of the same request — a job
  replayed, a POST resent — is answered from the key before the picker runs
  (no model call, no second charge), and two runs racing past that check
  collide on `_meta`'s primary key, which rolls the loser back whole.
  Measured on a local Postgres 16 (the history file has the probe).
- **The answer is what the database saved**: `rows: [{table, id, label,
  row}]`, the id the database assigned and the row as stored; `added: []`
  and no publish, because the pages read the list as it stands. The
  browser says "✅ Done — added “Rye & Caraway” to loaves (entry N).", N
  being that id.
- **The money**: one charge, `pageCredits` of the picker's and the row
  designer's usage. Under a job it is reserved before the write (a refused
  reserve writes nothing, `unbilled`) and kept only on a recorded outcome
  (below); inline it is collected after a write that was read back.
- **Eligible and protected, or no write** (2026-10-01, the owner's reviews
  of `31741f6f` and `c3e310e6`). Under a job, after the reserve, the
  statement is sent only after three yeses, in this order:
  1. **the gate**, `edit_may_publish`, the publish spine's own: one
     conditional update that grants only the lease's live holder of a job
     not finished, refunded, cancelled or under review, and billed
     (`reserved`, or `exempt` for a founder), and begins the write
     (`publishing`, `publish_started_at`) in the same statement;
  2. **the mark**, `edit_publish_mark`, with the request's key as
     `artifact_build`, which is how the reconcile knows a row job by its row;
  3. **the gate again, last**, since the mark matches no more than the
     holder and a refunded job's holder is still on its row.

  Anything else sends no statement (`row-unprotected`, *"nothing was
  added"*, which is true). A job the gate refused was never touched, and its
  consumer gives the reserve back. One the gate granted is parked by its
  consumer and refunded by the reconcile: from its key, closed first, or, with
  no key recorded, as never staged. The step's reply is kept either way.
  **Once the gate has begun the write, every road the ledger has treats the
  job as possibly written**: the consumer's refund, the lost-job sweep and a
  redelivery that finds no stored request all park it with the money held;
  the site is busy from the gate on, and takes no new job while it is
  parked; and only the reconcile settles it, from the key. No database
  function was changed for this.
- **The money is kept only on a recorded outcome**: `edit_committed`, with
  the key as the build, after the entries were read back. They come from the
  answer, from the key after a lost or unreadable answer, or as a repeat
  found by the check before the picker or by the write's own key. Without
  that record the finalize keeps nothing, and the review keeps the money from
  the key or refunds it.
- **An outcome the step cannot see** (the owner's review of `f6532d66`): a
  write whose answer is lost (`rowWriteOutcome`: no SQLSTATE, or a class
  whose error does not settle the commit: 08, 53, 57, 58, XX, 40003), or
  whose answer cannot be read back, is settled from the request's key.
  - When the key holds the whole of what was asked, the reply is what it
    saved, charged once.
  - Otherwise the outcome is unknown and said so (`row-uncertain`: never
    "nothing was added", never "try again"). Under a job it is said with the
    review, since the gate began the job's write before the statement.
  - The reconcile knows a row job by its key (`rowReviewKey`) and reads that
    key in the site's database (`rowReviewFacts`, `rowReviewVerdict`).
    Found: kept. Empty: closed first with `ROW_VOID` (`INSERT … ON CONFLICT
    DO NOTHING`), then refunded, or kept when the write committed first.
    Unreadable: left in review.
  - Inline, which has no job to mark, nothing is charged.
- **A definite refusal** (22, 23, 42 and the other listed classes) is refused
  as before. Under a job it reaches the review, since the gate began the
  job's write; the review closes the empty key, refunds, and keeps the
  step's own reply (`ROW_DEFINITE_REPLIES`, `keepsRowReply`).
- **Beside other kinds** a `row` is set aside and named (`row-alone`), and
  the rest of the message runs as before; beside a kind that hops to an edit
  rung (a photograph alone), the message is refused whole at no cost, so
  the entry cannot vanish on the hop.
- **Not shown**: real routing and the real picker/designer (supplied answers
  only), and any live write. Its known limits are in `docs/backlog.md`
  (*THE ADD-ON `row` STEP'S KNOWN LIMITS*).

### FRAME ITEMS, WORDS AND PHOTOGRAPHS (2026-10-02, on the branch; not merged)

Run 90 routed a footer link, a menu link, a header button, a line on a page and
a photograph on a page to edits, and four of them had no add-on kind. Fixed
together on the owner's word (`docs/history/2026-10-02-additions.md`):
- **`frame`** is dispatched, never designed here: asked alone it is handed to
  the menu editor as an addition (`ADD_HOPS` in `builder/site-addon.mjs`, the
  one list of hand-overs; the browser posts the edit with `addition: true`),
  and beside other kinds it is set aside and named. The menu editor, told it
  is adding, takes nothing away, repoints nothing, leaves the frame's
  arrangement alone, keeps the button (a new one is the second button; a third
  is refused), never rewrites or clears a footer detail, and adds to each
  page's own menu and footer lists.
- **`words`** is designed here: one line for a page the site has, placed
  exactly or refused (`no-words`), and found on the page with the text rung's
  reader before the bill, or 422 `not-landed` at cost 0.
- **`photo`** is designed here whatever company it keeps (the hand-off to the
  picture step is gone): one of the site's own photographs by its exact address
  (`ownPhotos`; anything else is `not-ours`), or one bought. A placed one is
  checked on its page before the bill; a photograph alone with nothing real to
  show is refused at no cost (`no-photo`), before the page call or after a
  failed purchase.
- **The loop bound**: an edit the add-on handed over that names the add-on
  again stops (`fromAddon`), with nothing changed.

### THE ADD STEP IS ITS OWN PATH TOO (2026-09-02)

`builder/site-add.mjs`, which imports nothing from `worker.js`:

```
customer ──► pick_adds ──► add_to_site ──► [make the db] ──► the page call ──► ONE PUBLISH
             1,936 chars   one per kind    first touch     (addon mode)
             9 kinds       0 required      then apply
```

**Nine kinds, and ORDER IS RUN ORDER** — a table before the function that reads
it, both before the job that runs it, all before the page that shows them.
`ADD_KINDS`, `OWN_ADDS`, `DISPATCHED_ADDS`, `PLACING_ADDS`, `BACKEND_ADDS`,
`addLayerIn` — **derive, don't trust**. Measured today: `DISPATCHED_ADDS` is
**EMPTY** and `PLACING_ADDS` is `["photo"]`.

| kind | makes | cap | the tool's own properties |
|---|---|---|---|
| `table` | a Postgres table; the first backend kind PROVISIONS the database | 6 | `table · seed · shows · because` |
| `function` | a Postgres function, public or internal | 6 | `name · args · returns · body · language · internal` |
| `api` | a stored outside connection | 4 | `name · url · method · headers · body · params · returns · credential · cacheSeconds` |
| `job` | a scheduled or one-time run of an internal function | 4 | `name · fn · everyMinutes · at · on` |
| `page` | a route, in `sitemap.xml`, linked from the nav | 6 | `path · name · purpose · sections · components · tsx · link` |
| `component` | a band on a page — a kit part by name, or a `tsx` part | 12 | `page · where · does · components · tsx` |
| `qr` | a code drawn by us, baked as `/qr-<name>.svg` | 6/site | `name · points · label · page · where` |
| `three` | a WebGL element | 1/site | `scene · page` |
| `photo` | a photograph bought from fal and placed in the same request | 6 | `page · describe · name` |

`MAX_ADDS` is 9; **SEVEN** answer LISTS (`LIST_ADDS` = `table · function · api ·
job · page · component · photo` — re-derived 2026-09-20; the record said "six"
and had gone stale). **No low limits while testing**
(owner) — every list rule says "as many as they asked for, and not one more".

- **A SECTION IS A COMPONENT** (owner: *"section is just adding a new component,
  so its a tsx step"*). The kind NAMES the component and where on which page. An
  answer naming neither is refused `no-component`.
- **One tool per kind, one property, nothing required** — the wall, not the
  rule. A four-part rule per kind (`is` · `yours` · `wide` · `keep`),
  `composeRule` refusing a missing part.
- **THE UNIVERSAL RULE** (owner: *"anytime something new is added it needs to
  keep the design system"*). `ADD_DESIGN_RULE`, ONE string sent to BOTH models
  that have to hold it, and the guard asserts both hops carry the same sentence.
- **AN ADDITION IS ALWAYS A NEW THING.** An ask for a section the site already
  has ADDS a second one, after the first, and the first is left exactly as it
  is. **THE WALL, not the rule**: every page the addition CHANGED must still say
  every word it said. `keptProse` is the SUBSET of `sameProse` counted as a
  MULTISET, so a quote carried twice and returned once is lost. A page that lost
  words is refused 422 `rewrote`, **cost 0**.
- **AND A SECOND ONE COPIES THE FIRST'S DESIGN** — same component, same wrapper,
  same layout; only the words are new. A rule to name the first one's component
  is empty without the FACT, so `pageComponents(sources)` reads each stored
  page's imports and `siteNote` prints "/ is built from: SiteChrome, …".
- **Refusals are sentences, never climbs** (`addRefusal`, `alreadyReply`).
  `ADD_ONLY_FIELDS` and `ADD_EVIDENCE` are the same two lists, so the two doors
  never bounce a customer between them. **A photo beside another kind is set
  aside and SAID.**
- **THE SITE'S OWN ADDRESS AND ITS PAGE LABELS ARE IN THE NOTE.** A QR "that
  opens the booking page" has no destination unless the designer is told the
  address (`publicUrlFor`) and what each page is CALLED (`pageLabels`, read from
  each page's `<h1>`) — three live declines cost 0 credits and bought exactly
  those two facts. `cleanAdd` resolves a bare route against that address,
  refusing `no-such-page` and `no-address` rather than guessing an origin.
- **EVERY DESIGNER'S RAW REPLY IS KEPT** at `source/<slug>/addon-answer.json`,
  written the moment the add loop ends and BEFORE a decline can return.
- **THE FOLD IS THE HOP THE OLD ROUTE NEVER HAD**: the page call gets a
  directive for the addition (file, route, LAYOUT, numbered bands, kit parts,
  where it links from) plus the union of kit parts. **`tsx` is APPENDED by
  name** — the old `mergeLook` REPLACED it, so a new part on a site that had one
  forgot the first on its next revise.
- **On the wire**: 1,936 picker + 1,299 (`three`) / 1,570 (`qr`) / 20,045
  (`table`) / ~35,000 (`page`, `section`) against 97,142.

**THE BACKEND IS THE ADDON'S** (owner: *"the build step doesnt have backend so
its gonna be on the addon step … if customer touches it then neon db is
created"*). **The first of any of the four tiers designed for a site with no
database MAKES the database**, through `ensureSiteBackend` — claimed atomically,
idempotent on a retry, gated under a job, before the schema is applied. A failed
provision is a named 502 that is `ours`. Three hops that were not obvious:

1. **each kind is its own call, so the job designer must be TOLD the function
   the function designer just declared** — designed functions are appended to
   `aSite.functions` (internal ones to `aSite.jobFns`) as they are cleaned, and
   `cleanAdd("job")` admits a job only against `jobFns`.
2. **a job on a STORED internal function is re-attached after `normalizeSchema`**,
   which keeps a job only when its function is declared in the same spec — right
   for a build, a silent drop here.
3. **the function designer is shown each table WITH its columns** — a `sql` body
   is parsed at CREATE, so a guessed column is a function that does not exist.

**A job, or an internal function alone, changes no page** (`pageless`): billed
through the ONE charge closure, answered in the page path's shape with nothing
added, no page call, no compile. **Measured live: 2 credits** (run 52), against
3 (run 50), 12 (run 49) and 13 (run 47).

**JOBS**: `JOB_ITEM` carries an optional `at` ("HH:MM", the site's local time)
for a daily-or-slower job — `everyMinutes` alone made "every day at nine" into
"every 1440 minutes from whenever it was added". **The zone is NOT the
model's**: the browser sends its IANA zone with the POST, read through
`validTimeZone` (asked of Intl, never a list). **Run now**: `POST
/api/site/<slug>/jobs {name, run: true}`, owner-scoped, the SAME `jobDeps` — the
press is the decision. A function may answer `{"did": "cleared 12 expired
holds"}` — **its own words, never a number read as "rows"**.

**THE PLATFORM-SIDE SERVICES** (each needs a credential AND a network call, so
none is a model step): **CSV import** (`site-csv.mjs`, RFC 4180 with quoted line
breaks, BOM, Excel's `;`, a cell read AS ITS COLUMN; a hundred rows an INSERT, a
batch Postgres refuses **retried a row at a time so the bad line names itself**,
an outage stopping it where it is — **not a transaction, deliberately**;
**never a member-written table**); **one submission, once** (`site-idem.mjs`: an
`Idempotency-Key` renewed only after a SUCCESS, ONE store at module scope plus
KV across isolates, **eventually consistent — two presses on different isolates
can both reach Postgres, named rather than papered over**); **member reset and
verification** (a LINK for reset, a CODE for verification — Neon's docs, read
rather than guessed); **inbound webhook signatures** (`authorize`, fail-closed
404, no replay guard).

**THE MESSAGE CONTRACT IS ONE STRING SENT TO BOTH STEPS.** `MESSAGE_CONTRACT` —
`{channel, to, subject, body}`, `"email"` or `"sms"`, **absent or unknown is
EMAILED** (email costs the owner nothing per send), an email needs all three of
`to`/`subject`/`body`, a text needs `to` and `body` and takes **NO `subject`**,
and each channel has its own key so a message whose channel has no key is HELD
rather than lost. **ONE string, not two copies**, asserted into both tools by
identity, and **the default is asserted against `shapeMessages` itself, never
against the sentence**. SMS was **UNDOCUMENTED TO THE DESIGNER** rather than
impossible — every hop worked for weeks while the word `channel` occurred ZERO
times in the `function` and `job` tools.

**A JOB CAN RUN ONCE AND THEN NEVER AGAIN (2026-09-19).** `spec.on`
(`"YYYY-MM-DD"`, the site's local time) is the whole representation and its
presence is the marker — one place to ask, no second flag that can disagree.

- **`on` REQUIRES `at`**, refused whole without it (`no-time`): a one-time
  reminder has no second occurrence to be right at, so "midnight, presumably" is
  a guess made once and then made for ever.
- **⚠ AN UNREADABLE `on` REFUSES THE JOB rather than falling back to the
  interval**, and this is the ONE place the engine departs from its tolerant
  habit. Dropping `on` leaves a perfectly valid RECURRING job, so the tolerant
  reading is not the feature degrading, it is the feature INVERTED — one message
  becomes one a month for ever.
- **`everyMinutes` IS FORCED TO THE MONTHLY CEILING** (`MAX_EVERY_MINUTES`,
  twinned with `MAX_JOB_MINUTES` and censused equal), so if `spec.on` is ever
  lost such a job degrades to *at most monthly*. **The forcing sits ABOVE the
  `at` gate** and the order is load-bearing.
- **THE CLAIM CONDITION SURVIVES "RUN NOW".** The owner pressing the button
  decides a job is due NOW; it cannot decide a one-time job is due TWICE. A
  one-time job's claim filter is always `&last_run=is.null`.
- **`last_run` IS THE CONSUMPTION RECORD, AND IT IS THE ONLY ONE AVAILABLE.**
  `persistSiteJobs` rewrites `spec` on every publish, so a `done` flag written
  there would be destroyed by the next unrelated change.
- **AN ATTEMPT CONSUMES THE OCCURRENCE**, because `runJob` stamps before it
  sends — deliberate: a retry after a provider timeout is how one reminder
  becomes two, and nobody can tell a timeout from a slow success.
- **`MISSED_GRACE_MS` IS 24 HOURS** and past it the occurrence is gone rather
  than late. `onceState` answers `scheduled · attempted · missed · unreadable`
  — **`attempted` deliberately, not `done`**: what `last_run` records is that
  the one run was used up, and whether anything arrived is the result line.

**THE SELECTOR AND THE CLAIM ARE ONE RULE.** `dueJobs` moved to the occurrence
rule when the manual-run drift was fixed and the stamp's filter stayed the
elapsed one — so a job the calendar selected was refused by the same code path
meant to run it (0 rows matched, `fnCalls` empty). `claimFilter` is a
compare-and-swap: **`last_run` IS the etag**, so the claim asks *"is this the
row I selected"* and never re-derives dueness. Two ticks that both select one
job send the same condition and exactly one PATCH matches. **`jobDeps`'s `force`
option is GONE, not defaulted.**

**A MANUAL RUN MUST NOT MOVE THE NIGHTLY OCCURRENCE.** The elapsed test measured
24 hours from whenever the job last ran, so one press slid the schedule to the
hour of the press — for ever. **For a daily-or-faster clock-time job the
occurrence gate is the whole rule**: `anchor >= due` refuses a job that has run
since the latest occurrence, whatever ran it, and at `mins <= 1440` there is
exactly one occurrence a day. **Slower than daily KEEPS the elapsed test** — a
weekly 09:00 has to skip six occurrences — and measuring it to the OCCURRENCE
instead of to `now` was tried and is WORSE. **Stated in the code**: a manual run
still perturbs a job slower than daily; fixing that needs the last SCHEDULED
occurrence stored apart from `last_run`, which is a migration.

**AND THE OCCURRENCE RULE EXPOSED A DAYLIGHT-SAVING BUG UNDER IT.** `lastDueAt`
read the offset at `now`, so the instant a zone moved, "today's 00:30" was
computed under the new offset and landed an hour past the one already served —
and stood for the rest of that local day. The doc comment conceded the
approximation and named the rule that covered it — *the interval rule that runs
beside this* — which is the rule the fix above took off. **The fix reads the
offset at the TARGET MINUTE**: the two offsets in force a day either side are
the only two that can apply, each candidate VERIFIED by formatting it back,
two local days asked (complete rather than a sample, since an occurrence carries
the local date it belongs to).

| the local time | the occurrence | why |
|---|---|---|
| **repeats** (autumn) | the **FIRST** reading | one local day stays one run — `anchor >= due` then refuses the second |
| **never happens** (spring) | the **LATER** candidate | the job is NOT skipped; a reminder that silently does not go out once a year is the failure nobody notices |

**AND THE ARITHMETIC IS THE ZONE'S, NOT AN HOUR'S** — proven on
`Australia/Lord_Howe`, which shifts by **thirty minutes**: a nonexistent 02:15
resolves to **02:45 local**. A fix that hardcoded an hour passes every London
case and fails both of those.

### WHAT THE ADDON REPORTS, AND WHAT IT REFUSES TO CLAIM

**A REQUIREMENT IS REPORTED ONLY WHEN IT IS THEIRS, AND ONLY AS WHAT RAN**
(2026-10-05, on the branch, not merged or deployed;
`docs/history/2026-10-05-judgment.md`). Three checks, split on the owner's
line:
- **provenance (code)**: its quoted words are in what they wrote
  (`groundRequirements`);
- **meaning (the model)**: one small call on the add step's own model
  (`runJudge`, `judge_requirements`) says whether each requirement was
  `asked`, is `needed` for what they asked, is `optional` or is `unrelated`,
  and which listed thing carries it out. It runs before a requirement is
  handed to a later step (meaning only) and after the last designer (with
  everything designed in view). An optional one is offered as a suggestion;
  an unrelated one is recorded (`setAside`). **Every requirement it is shown
  needs a verdict anybody can use** (2026-10-06,
  `docs/history/2026-10-06-incomplete-judgment.md`): an answer that leaves
  any without one is asked once more, naming each and why (the reply
  writer's bound: two calls at most); still short, or cut off, the addition
  stops before anything is applied or charged (`aDown`, `incomplete: true`)
  with a sentence that asks the customer for nothing. `unsure` is a whole
  verdict, and a malformed one is never read as it;
- **every requirement told, one fact each** (2026-10-06,
  `docs/history/2026-10-06-requirement-reporting.md`): `requirementReport`
  returns every requirement the customer hears about, whole, with the sentence
  it belongs to (`told`) and what became of it (`state`); the route sends it
  (`requirementsTold`) beside the note's other sentences (`coverOther`), each
  requirement is its own fact for the reply model (`coverFacts`), and the note
  the browser prints is written from the same report with nothing cut;
- **execution (code)**: every thing it names must be one it was shown, and
  must really have been applied or already be there — for a table, with the
  part that does the work (`tableParts`: `notify`, `confirm`, `sms`,
  `webhooks`, `payment`). The route reads every report with
  `judged: true`; a verdict of `unsure` falls to the designer's own
  reference and can no longer reach `unverified`, `configured` or
  `delivered` (`capped`).

**The reporting system is the addon path's largest body of law**, built across
2026-09-13 → 09-20 from roughly thirty reproduced defects. Every rule below was
driven through `POST /api/site/<slug>/addon` against stubbed seams before it was
believed; the narrative of each round is in git.

**THE METADATA RIDES BESIDE THE DESIGN, NEVER INSIDE IT.**
`builder/site-requirements.mjs` owns `REQUIREMENT_ITEM` — `need` · `status`
(`covered` | `elsewhere` | `unsupported`) · `by` | `step` | `why` · `item` ·
`kind` · `answers` — as a SIBLING of the kind on the add tool. Inside
`TABLE_ITEM` it would reach `design_schema` (which binds that item by identity),
enlarge the build's 97,142-character tool, and become a promise the schema
ENGINE must keep. **All nine kinds offer `requirements`**, measured by
evaluating `addTool(k)`.

**SEVEN STATES, AND EACH PAIR EXISTS BECAUSE THE TWO NEED DIFFERENT SENTENCES:**

| state | when | what the customer hears |
|---|---|---|
| `delivered` | a `checked` behaviour ties the claim to the work | nothing |
| `configured` | a real SETTING read back off what was applied matches | "I can't confirm…" |
| `unverified` | it is there, or nothing here can see whether it is | "I can't confirm…" |
| `unknown` | nothing established either way | "I can't see from here whether…" |
| `missing` | this layer looked and the work is not there | "Still to do: …" |
| `blocked` | the step this need depends on ran and FAILED | "waiting on another part…" |
| `failed` | we said we could not, or the claiming step failed | "Still to do: …" |

- **`checked` IS EMPTY AND THAT IS THE CORRECT ANSWER.** Nothing on this path
  exercises a behaviour, so `configured` is as far as a claim about a real
  setting can get. The three wrong fillings are named in `appliedFacts`' own
  comment: configuration (collapses the distinction), a keyword match
  (`claimEvidence` already asks that, so the claim would be its own evidence),
  and one passing live run. The guard drives all seven applied kinds and asserts
  every `checked` is `[]`. **So the platform cannot confirm its own feature
  works** — runs 49 and 51 were confirmed from OUTSIDE, by a browser and by
  re-encoding the published QR file. That is a stated limit of the design.
- **A REFERENCE IS `{kind, name}`, BECAUSE A NAME COLLIDES.** `bookings` is the
  commonest name on this platform to be a table AND the thing a job is named
  after. `referenceOf` is the single producer and `broken` is keyed the way it
  answers. **Where the kind comes from is the only per-status part**: an
  `elsewhere` reference is a request TO a named step, so the STEP is the kind; a
  `covered` reference has no such field (`from` is which CALL answered, never
  where the thing lives), so the kind is DECLARED. `ITEM_KINDS` is DERIVED
  (`COVERAGE_STEPS` less `edit`) and censused both ways against the tool's enum.
  **An unknown kind is DROPPED, never repaired to a plausible one.**
- **AMBIGUOUS OUTRANKS EVERY WEAKER READING.** A reference with no kind reads
  `unknown` with `unresolved: "no-kind"`, never rescued by evidence about a
  thing the designer may not have meant. Asked AFTER the two failure branches.
- **`evidenceItems(made, impl)` IS THE ONE SCOPE, DERIVED FROM `impl` RATHER
  THAN RE-RESOLVED.** An `item` reference sees that `{kind, name}` and nothing
  else (a miss is EMPTY); a `kind` reference sees the responsible step's own
  output; no kind sees nothing. **An item reference is never narrowed by
  `from`.** The stricter reading — no prose match at all — was DRIVEN and lost
  five real findings, three of them the owner's own demonstrations.
- **EXISTENCE IS NOT DELIVERY.** Each applied item carries `holds` (words from a
  closed vocabulary true of it), `fails` (words from that same vocabulary that
  are false) and `checked`, and **`fails` is asked FIRST**. The vocabulary is
  the ENGINE'S OWN (`ACCESS_PRESETS` ∪ `READ_LEVELS` ∪ `WRITE_LEVELS`), never a
  second list. **`evidenceName` is word-bounded, never `includes`** —
  `bookings` must not match inside `bookings_old` — and a name under three
  characters is never evidence.
- **A CONTRADICTION IS ITS OWN KIND, NOT A `null`.** `unknown`'s sentence —
  *"nothing I can check says either way"* — is FALSE of a contradiction, where
  something can be checked and it says the opposite. It answers `contradicted`,
  reads `unverified`, and records `contradictedBy`.
- **WHY THIS CANNOT CRY WOLF**: every reading moves a requirement towards
  `unverified` and never towards `failed` — there is no corpus of real `by`
  claims to measure a false-alarm rate against. A false "I can't confirm" costs
  a look; a false "done" costs them the guarantee.
- **"NOT ADDED BY THIS CHANGE" IS NOT "ABSENT FROM THE SITE".** `existingFacts`
  is the second presence source (the stored spec's four tiers, the site's own
  routes, the look's `qr` and `three`), and the record carries **`foundIn`**
  (`applied` | `existing`), because *this change made it* and *the site already
  had it* is the distinction and a record collapsing them cannot be audited.
- **ABSENCE NEEDS EVERY READER THAT COULD SPEAK TO HAVE SPOKEN, and that is NOT
  a blanket demand for two readers** — the first cut demanded both everywhere
  and lost a real finding. `COVERAGE_STEPS` splits three ways, total and
  disjoint: `SITE_KINDS` (`table · function · api · job · page · qr · three ·
  **photo**` — EIGHT, re-derived 2026-09-20; the record listed seven and had
  gone stale when photo joined the coverage steps)
  claim absence only when the inventory was really READ; `OPAQUE_KINDS`
  (`component`) **never**, because an addition folded into an existing page
  leaves no item in any list; and `edit` names no artifact at all.
  **`OPAQUE_KINDS` is load-bearing and a sweep proved it** — for `component`
  every other wall is open and it is the whole of what stops a change reporting
  a working section as still to do.
- **`aReportable` IS PER KIND.** A code is settled by the look merge long before
  any backend apply, and on a change with no database `aApplied` is false for
  ever — so a code this change really made would have read as unseeable on every
  frontend-only addon there is. `ready` names the kinds whose results arrive on
  their own clock.
- **A COUNT OF A STEP'S OUTPUT IS NOT AN ASSOCIATION WITH A REQUIREMENT.** A
  rule that let a step's output answer an un-named hand-off when the counts
  matched was **unsound at every N, not at the margin** — its argument was about
  CARDINALITY and silent about CORRESPONDENCE. Reproduced: a `page` step hands
  *"A QR code opens the gallery page"* to the `qr` step, which makes one Wi-Fi
  code, and the two cases came back byte-identical. Gone.
- **A FAILURE IS SCOPED TO A THING, NOT A KIND.** `failedItems` is
  `[{kind, name}]`; a requirement that NAMES its dependency is judged on that
  dependency. **Both halves are asserted**, because a fix that simply stopped
  blocking would lose the real dependency failure: the kind-wide rule survives
  with `!depThere` as its scope. **`depBroke` is asked before `depThere`**, so a
  thing KNOWN to have failed is blocked before anything excuses it.
- **THE HAND-OFF AND ITS ANSWER ARE ONE OUTCOME.** `cleanRequirements` stamps
  `<step>#<position>` on every entry it keeps; `requirementBrief` prints each
  handed need as `[function#0] …`; `reconcileHandoffs` joins on that id and
  nothing else. **Four conditions**: the answering entry must NAME the hand-off
  (never "this step ran"), be `covered`, have its own implementation FOUND, and
  the result is **CAPPED at `configured`**. **Both entries survive for
  diagnosis**; it is the CUSTOMER NOTE that collapses them.
- **AN ECHOED ID SAYS WHICH REQUEST IS BEING ANSWERED; IT SAYS NOTHING ABOUT
  WHETHER THE ANSWER IS TRUE.** Three walls: a known problem (`blocked`,
  `failed`, `missing`) is never overwritten; the answer must come from the step
  the request was addressed to; and if the request named its own thing, the
  answer must be that thing by `{kind, name}`. **Refusing to reconcile is only
  half the fix** — the answering entry was still `configured` and still reached
  the prose, so one need came back as two opposite sentences with the reassuring
  one being the worse. Keyed by the echoed ID, never by the need text.
- **AN UNRESOLVED ANSWER MAY NOT REGAIN CERTAINTY THROUGH PROSE.** With no item
  the answer's own implementation is `unknown`, so it is capped there —
  **`unknown` and not `!== "found"`**, because an answer naming an item this
  layer LOOKED FOR AND DID NOT FIND reads `absent` → `missing` → *"Still to
  do"*, the most actionable line in the reply. `spokenForBy` names the request
  that speaks for it, silent in the prose and whole in the record.
- **`auditTier(spec, tier, context)` IS ONE CORE** and `refusedFields`,
  `droppedFields`, `unbuiltItems` are thin wrappers defaulting to
  `tier: "table"`. The observer was dead above the table tier for three of four
  tiers — `droppedFields({functions: […]})` answered `[]` whatever it was
  handed — a clean sweep over nothing, indistinguishable from a designer that
  stayed inside the tool. **A/B over 64 specs: ZERO differences on `reached`,
  ONE on `refused`**, and the old reader was right about that one.
- **FOUR BUCKETS, AND EACH ASKS A DIFFERENT QUESTION**: `reached` (the key
  reached something), `refused` (the effect is not live), `changed` (a declared
  value the pipeline KEPT under another value — `method: "PUT"` stored as
  `"GET"`), and `unexpressed` (the ENGINE would have used it and this step lost
  it — `engineWouldUse` asks the engine directly rather than keeping a list).
  **`scanned` rides beside them**, because every one is a NEGATIVE assertion.
  **A REFUSAL ASKS WHETHER THE FIELD'S EFFECT WAS LIVE, not whether its key
  survived** — `cacheSeconds: 300` is kept as `ttl: 300`, and `maxRows: -5` is
  kept as `maxRows: 0`, where zero means NO CAP.
- **THE VALIDATION READS WHAT THE MODEL DECLARED, NOT WHAT THE CLEANER KEPT.**
  `cleanAdd` REBUILDS a `function`, `api` or `job` out of the keys it knows;
  only `table` spreads, which is the accident that made the table tier look as
  though this worked. `auditTier` takes `{ sent }` — a Map of name → the item
  that really goes into the engine — and reads the keys off the DECLARATION.
  **By NAME, never by position.** **And normalising what was SENT is not the
  same as normalising the DECLARATION** — measured over ten shapes, ONE divides
  them and it is a privacy guarantee: `internal: "yes"` is truthy and is not
  `true`, so the function is created PUBLIC; from what was SENT that reads
  `refused` and from the DECLARATION `changed`. **`refused` is the true one.**
- **VALIDATED WITH ITS DEPENDENCIES PRESENT.** `normalizeSchema({jobs:[job]}).jobs`
  is **`undefined`** — the job vanishes, its function absent. Correct
  normalisation and the wrong question: the item is normalised INSIDE the
  accumulated proposal.
- **THE BASELINE AND THE PROPOSAL ARE TWO SPECS.** `aBaseline` is the stored
  spec and is never written to; `aProposed` accumulates every cleaned item in
  `ADD_KINDS` order and `aSite = siteFacts(aProposed)` is rebuilt after each
  kind, marked **"(being added by this same change)"**. An EXTENSION merges
  through **the APPLY'S OWN `mergeAddonSchema`** rather than replacing by name —
  the commonest addition there is arrives as one column and no access, and
  replacing had been handing the next designer a three-column table as one
  column with `collect` stamped on it.
- **ONE NUMBER PER BODY WALL, AND THE CLEANER REFUSES RATHER THAN CUTS.**
  `MAX_FN_BODY` and `MAX_API_BODY` are both **4000** and both exported. The
  function wall had been **8,000 in the cleaner against the engine's 4,000** —
  two copies of one number, drifted by a factor of two, so a body in between
  passed whole, was reported as added, and reached Postgres as 4,000 characters
  of a statement. **The API half needs a real POST to see at all**: a GET's body
  normalises to `""` whatever it declared.
- **NOTHING REQUESTED IS DISCARDED IN SILENCE.** A bare-string column is **kept
  as `{name}`** (the engine gives a nameless-type column `text`); a column that
  really cannot be read is named on `droppedFields`; a kit name failing `NAME`
  lands on `unknownComponents` via a pre-pass over the RAW list; a `tsx` entry
  missing `does`/`props` is named and **not repaired**, because those ARE the
  component; and a list cap is `over-cap` BY NAME, its own token, **below** the
  loop that fills `skipped` — the same correction `cleanAdd` made for itself.
- **COMPLETION HAS THREE STATES, NOT TWO** (owner: *"Something existing does not
  prove the requirement works"*). **THE EVIDENCE IS ASYMMETRIC** — a call to a
  function that failed proves a problem; the absence of one proves nothing.
- **A FAILED JOB REGISTRATION IS SAID**, and a job whose new function the
  database refused is **blocked per job, by the name of the function IT runs**,
  taken off `aJobs` AND off `merged.jobs`. Its schedule is real and the work it
  does is not.
- **A PUBLIC FUNCTION AND A CONNECTION CANNOT BE PAGELESS** — both exist to be
  read BY A PAGE. **A CONNECTION OR A CALLABLE FUNCTION IS A BACKEND**
  (`siteHasBackend`, against `siteHasTables`): four places agreed and all four
  were wrong about a site with one connection and no tables, so the connection
  was designed, applied, served — and unreachable from every page.
- **TWO REFUSALS ARE 409s WITH THEIR OWN FLAGS**, never the missing-agent 404: a
  disabled automation and a paused agent are both "not now". **Nothing at all is
  written on either path.**
- **A JOB REUSING A STORED INTERNAL FUNCTION READ AS NEVER CREATED (run 52).**
  `applySiteSchema` persists a function with **NO BODY** and `normalizeSchema`
  drops a bodiless function, so the audit called the job `unbuilt` while the
  apply three hundred lines later re-attached and registered it. **Fixed at the
  source**: `withJobDeps` gives a declared internal function with nothing to
  normalise a stand-in body, and `storedJobFns` is the ONE answer to *which
  functions may a job name*, read by the apply too. **The repaired context is
  never applied** — re-sending a stored function would `CREATE OR REPLACE` the
  live one with the stand-in — so the stand-in is deliberately not runnable SQL.
  **Scoped to the job tier by its caller**: a table's `confirm.fn` is nulled by
  the APPLY too, so repairing it would make the audit disagree the other way.

### RUN 53 — WHAT THE CHECK CAN STAND IN FOR, AND WHAT SHIPPED (2026-09-20)

One paid addon run produced two independent false reports, and the honest
summary is that **the connection, the declared shape and the page were all
correct**: `/rates` is live and renders `1.1644 / 1.3344 / Rates from
2026-09-18` with zero console errors. Everything wrong was ours.

**AND THAT SENTENCE IS A CAPABILITY PROOF, NOT ONLY AN EXONERATION — READ IT AS
BOTH.** Those three values are the REAL keyless rates service's own answer,
fetched through the platform's own `/api/db/<slug>/api/<name>` and read at two
depths, so **run 53 is the live proof that a published page reads an outside
connection and renders its data** — the `api` row's "not established" for a
year. It went a day unrecorded because this section is a STORY about two
defects, and nobody edits a capability table while writing up a bug. **The row
is updated; when a run proves something, edit the SUMMARY first.**

**A SYNTHETIC RESPONSE MUST NOT STAND IN FOR A DEPENDENCY WE CANNOT REACH.**
`serveDist` answered **`200 []`** to every `/api/…` path that was not auth — so
the render check handed a page reading `data.rates.EUR` an empty ARRAY, which is
truthy, and the page threw reading `.EUR` of `undefined`. The check reported it
`threw`, which is **SERIOUS**, and `isSerious` is what `site-repair.mjs` and
`site-add.mjs` read to buy a paid repair of code that works.

- **`apiAnswer(pathname)` IS THE ONE CLASSIFIER**, and it splits *supported
  fixture* from *unavailable dependency*. Supported: `rows` (`200 []` — an empty
  table list is a REAL answer and the page draws its empty state), `auth` (401),
  `turnstile`, `error`. Unavailable: `api`, `rpc`, `checkout`, `uploads`, `hook`
  and **every path it does not recognise**, which fails CLOSED.
- **THE RPC TEST SITS ABOVE THE DATA TEST AND THE ORDER IS THE RULE.** `useRpc`
  posts to `/api/db/<slug>/data/rpc/<fn>` — inside `/data/` — and a function may
  return an object or a scalar, so the table-list fixture is exactly as wrong
  there as it was for `api`. The guard asserts the ordering, not just the rows.
- **424, NOT 503, AND THE SITE'S OWN RETRY POLICY IS WHY.** `router.tsx` fails a
  4xx immediately and retries a 5xx twice at 500/1000 ms — so a 5xx would spend
  the check's clock on a dependency that is never coming.
- **`unmet` IS A FINDING KIND AND IS NOT SERIOUS**, the `slow` precedent. The
  customer's sentence is *"reads something the check can't reach, so I couldn't
  see it with real data"* — which is what it is, and never a page error.
- **THE BROWSER'S OWN REPORT OF OUR REFUSAL IS NOT THE PAGE LOGGING AN ERROR.**
  Chromium writes `Failed to load resource: …424` to the console for every
  marked response, so the first cut reported our own fixture as `logged`.
  `ourRefusal(line)` filters those and ONLY when something was really unmet.
- **THE GUARD WAS VACUOUS BEFORE IT WAS FIXED, and the trap is this file's own.**
  It asserted through `checkRender` that nothing `threw` — and CI has **no
  browser**, so `checked: 0` made every absence true about nothing. `serveDist`
  is exported now and the wire is driven with plain `fetch`; the finding readers
  are pure. **Separately proven with the REAL hooks in a REAL Chromium**
  (`src/lib/rows.ts`, the site's own retry policy, run 53's `data.rates.EUR`
  read): both refusals draw the page's error state, the table list draws its
  empty state, nothing throws, `isSerious` is false — and a genuine error on the
  same page is still `threw` and still serious.

**`aShipped` WAS THE PLAN LESS THE MISSING, SO A PUBLISHED PAGE WAS NOT IN THE
INVENTORY.** The `api` designer handed two needs to `page`; the `page` KIND
designer declared NOTHING, which is correct — a connection is not pageless, so
the PAGE CALL writes the page. `aWanted` is the kind designer's answer, so
`aShipped` was `[]` on a change that published `/rates`.

- **EXISTENCE COMES FROM THE PUBLICATION, ABSENCE COMES FROM THE PLAN.**
  `aShipped` is now derived from `aFilesOut` (`aMerge.added` + `changed` — what
  really compiled and shipped); `aMissing` is still `aWanted` less that. Two
  questions, two sources. They cannot disagree, because they read the same
  artifact rather than one being defined as the other's complement.
- **A COMPONENT IS NOT A ROUTE AND `routeOf` CANNOT SAY SO** — it answers
  `/-parts/tide-chart`, measured. Since the band split the publication carries
  components too, so the `PART_DIR` filter is what stops every section this
  change wrote arriving as a page a visitor can open. **⚠ IT IS A BELT AND
  CANNOT FIRE TODAY, and a sweep called the comment that said otherwise.**
  Cutting the filter SURVIVED every guard, so it was measured rather than
  argued: `aFilesOut` is `mergeAddonPages` over the PAGES alone and components
  merge separately into `aParts`, so no entry can contain `-parts/` — driven
  through the route, a change writing `tide-chart` answers
  `changed: ["index.tsx"]` with the component in the container's own `parts`
  list. **KEPT deliberately and said so in the code**, because the day
  components join that list is one edit to `aFilesOut`; the PAIR is swept
  (parts added AND the filter cut) and dies.
- **THE DISCRIMINATOR IS AN EXPLICIT ITEM REFERENCE.** A need naming NO item has
  nothing to look up and reads `unknown` on BOTH sides of this fix — so a case
  built only out of run 53's two unnamed needs cannot tell the versions apart.
  Measured on the reproduction, reverting the derivation and nothing else:
  applied pages **`[]` → `["/rates", "/"]`**; the named need **`missing`/`absent`
  → `unverified`/`found`**; both unnamed needs **`unknown` → `unknown`**; the
  unrelated `/stockists` **`missing` → `missing`**; counts **missing 2 →
  missing 1 + unverified 1**; and `"Still to do"` stops naming `/rates`.
- **PUBLISHING A PAGE PROVES THE PAGE IS THERE AND NOTHING ELSE.** The ceiling
  is `unverified`; `checked` stays `[]` for `page` as for every kind, so
  `delivered` is unreachable from a publication. Publishing ANY page still
  satisfies NO page requirement that does not name one.
- **⚠ RUN 53'S OWN `missing: 2` IS CONSISTENT WITH THE INFERRED `/rates`
  REFERENCES — NOT REPRODUCED, AND NOT "ANOTHER, UNIDENTIFIED CAUSE".** Two
  earlier notes overstated it in opposite directions; this is the standing
  reading. **THE EVIDENCE LIMIT IS EXPLICIT AND STAYS**: the capture truncates
  at `…right now","statu`, so what those two entries declared past `status` is
  unknown, and **the stored record is not readable from a session** —
  `ADDON_ANSWER_KEY` (`source/<slug>/addon-answer.json`) has **no reader
  route**, `GET /api/site/answer` serves `answer.json` ALONE, and the free
  `answer read` workflow checks out `ref: main` and defaults to another slug.
  Recovering it needs a reader, a merge and a press. **Nothing invents those
  fields.**
  What the deployed code (`d304120e`, byte-identical here in
  `site-requirements.mjs` and `site-add.mjs`) does settle: `missing` is
  reachable from ONE line, `impl.state === "absent"`; the only other "Still to
  do" state is `failed`, which needs `status: "covered"` (both are `elsewhere`,
  and the capture records `0 unsupported`); and with NO item `absent` comes from
  the kind branch, gated on `mine.length || theirs.length`, where `theirs` is
  the site's own routes. **repairbench-1 HAD routes** — its live sitemap answers
  `/`, `/booking-check`, `/rates`, `/status`, `/workshop-load`, `/rates` being
  the one that run added — and the reply's own *"updated /"* says so a second
  way. **Measured on the real readers with those routes present**: no item →
  `unknown` on BOTH inventories; `item: "/rates"` → **`absent` before, `found`
  after**. So an item-less reading is RULED OUT, a `/rates`-or-`/` reading is
  consistent and is corrected by this fix — **and a third reading survives**: a
  reference naming a page NOBODY published is equally consistent with `missing`
  and is NOT changed by the fix, correctly, being a true "still to do". The
  guard drives the measurement so the inference cannot rot into a story.
  **AND THE *"I can't see from here whether…"* CLAUSE IS NOT THIS FIX'S EITHER**
  — run 53 never printed it at all; it belongs to the item-less fixtures.

### THE ADDON KNOWS WHAT THE SITE IS

- **A PAGE THIS SAME CHANGE IS ADDING IS A REAL DESTINATION.** `page` runs
  before `component`, `qr`, `three` and `photo` in `ADD_KINDS`, so
  `site.planned` carries `{path, name}` and **`going = have ∪ planned` is the
  ONE list** both "where may this go" and "where may a code point" are answered
  from. `siteNote` prints the planned pages on their OWN line, saying they do
  not exist yet. **`SPEC_OF_KIND` HAS NO `page` ENTRY AND MUST NOT GAIN ONE.**
- **THE ONE-PAGE SHORTCUT READS THE POST-CHANGE SITE.** Its whole justification
  is *"a site with exactly one page has exactly one place a component can go"*,
  which expires the instant this same change adds a second. **A NAMED route
  resolves to that route or to NOTHING** — `onPage` answers `{page}` or
  `{bad: true}`, and all four placing kinds refuse `no-page` on `bad`. **An
  omitted optional placement is untouched** (absent still answers `""`), and
  **prose is a named destination too**: `route("the gallery page")` is `""`, so
  a designer writing a page's NAME took the no-answer branch and landed on the
  front page exactly as `/nowhere` did. Whitespace alone is an omission.
- **AN EXISTING COMPONENT IS NOT ONE TO BUILD.** `look.tsx` is the cumulative
  DECLARATION list — true of a component nobody ever wrote — and the page writer
  was handed it under *"the kit does not have these, so you write them"*, so
  `mergeParts` replaced a real file by name: **a rewrite of working code from
  its own summary, with nothing saying it had happened.** `partsSent` decides
  once and is read twice: `{shown, withheld, names}` over
  `source/<slug>/parts.json`, showing the source of what fits and **NAMING what
  does not, with an instruction** — a withheld component said nothing about is
  indistinguishable from one that does not exist. `tsxDirective(tsx, names)` is
  filtered by **every** name the site has a file for. **TWO BOUNDS**:
  `MAX_PART_CHARS` **12,000** for one and `MAX_PARTS_CHARS` **36,000** for the
  block, against `MAX_PRIOR_CHARS` (**90,000**, the PAGE source, which keeps the
  larger share). In stored order and **never sorted by size**, or which
  component is shown would depend on the others.
- **`readSiteParts` ANSWERS `{ok, parts, why}` — THREE STATES.** The route read
  the store TWICE, minutes apart, and the two could disagree: a first read that
  THREW gave `partsSent` `null` (no source shown, the DECLARATION handed over,
  the wall with nothing to refuse) while the second SUCCEEDED and the merge
  replaced the real file. One snapshot now serves the note, the prompt, the wall
  and the merge. **With BOTH reads failing, `mergeParts(null, [one])` answers
  `[one]`** — every other component deleted, none of them named. While `ok` is
  false nothing is offered, every returned component is refused, and
  `parts.json` is not written at all. **A different refusal needs a different
  sentence**: `keptPartsNote` is about a SIZE BOUND, `unseenPartsNote` about a
  store that failed.
- **THE SAME SHAPE IS LIVE ON THE EDIT PATH** (`worker.js`'s `pStored` read) and
  is in the backlog, not fixed there.
- **THE LOOK IT IS WEARING, AND THE SIGNATURES IT NEEDS.** The page writer gets
  the theme and the site's own stylesheet **as ALREADY APPLIED** — a model shown
  one with no such sentence restates its rules inline, where editing the
  stylesheet can no longer reach them; over `MAX_STYLE_CHARS` (**16,000**) it is
  cut and **the cut is announced**. `plan.components` gains the kit modules the
  pages being edited already import. **`pageComponents` answers EXPORT names and
  `siteComponentApi` is keyed on MODULE names** — handing it the exports answers
  `""` for every one, indistinguishable from a site importing nothing, so one
  walk answers both.
- **A SITE TOO LARGE TO SHOW WHOLE KEEPS ITS CONTRACT AND SAYS WHAT IT HID.**
  Over `MAX_PRIOR_CHARS` the block fell through to a REVISE's wording — *"write
  them again in full"* — on a path where a returned page REPLACES the stored
  one, losing `remove`, the byte-identical rule and *"a page you do not return
  is KEPT"*, with `ok: true` and **nobody told**. `priorPagesSent` is
  `partsSent`'s shape one layer over: a page named and not shown is told it must
  not be returned. **`keep` is the pages this change is about, then the HOME
  page** (the nav anchor almost every addon touches). **A page too big for what
  is left is SKIPPED, never a stop**; **the wire order is the SITE'S**, whatever
  `keep` did to the selection; **one selection, two readers**, because a fallback
  living in the BLOCK left the route's own reader reporting a shown page as
  unseen. Measured: **0 of 100 corpus sites exceed it**, the largest being 50,646
  characters over 6 pages, so this arrives by growth.
- **A PAGE HAS ONE IDENTITY.** `cleanPath` strips the `src/routes/` prefix, so
  every persisted path is bare and a keep list built with the prefix could never
  match — the large-site selection was stored order on every real site.
  `pageId` is the one definition, asked of both sides, and the comparison is
  **case-insensitive ON BOTH SIDES** (`SAFE_PATH` carries `/i`, so `About.tsx`
  really is stored with its capital). **The fixtures were the reason it
  survived**: every stored-page fixture carried the prefix, so the guard's two
  sides agreed by accident and `keptProse` had never fired in any of them.
- **THE PRESERVATION POLICY HAD ONE REASON AND NEEDED TWO.** Reachability is a
  guess about a page NOBODY mentioned — a good guess, bought by a live run where
  *"add a gallery page"* rewrote four of four pages for 28 credits. `asked` is
  not a guess: it is the destination a CLEANED designer answer NAMED.
  **`aAskedPages` and `aKeepPages` are two lists out of one walk, and the
  difference is the `/`** — the home page is a BUDGET decision, not a claim that
  anybody asked, so handing the window's list to the merge would exempt `/` from
  preservation on every addon.
- **"updated", NOT "linked it from".** `added.length ? "linked it from" :
  "updated"` was an INFERENCE from *a page was added* to *this changed page
  carries the link*, written when that was the only reason a page could change
  beside an addition. It contradicted itself in one sentence — *"added
  /gallery, linked it from /. Nothing links to /gallery yet…"*.

### PHOTOGRAPHS, CODES AND SCENES ON THE ADDON PATH

- **A BUDGET OF OURS IS NOT A FACT ABOUT THE SITE.** `imageDirective(0)` said
  *"PHOTOGRAPHS: none on this site"* — measured identical on a site showing two
  bought photographs. The zero is stated as OURS; what the site has is a second
  sentence. **`shownPhotos` IS THREE-STATE**: `null` is "nobody looked" and gets
  *"Leave every picture already on this site exactly as it is."*
- **THE DISCRIMINATOR IS HOW THE SITE USES THE FILE, not what it is called.** A
  `src` — attribute or object key — is a picture the site DRAWS; an `href` is a
  file it LINKS. An extension rule would be a second idea of what a picture is
  and would be wrong about a `.jpg` offered as a download.
- **`photoInventory(pages, parts, partsKnown)` IS THE SIXTH STEP ASKING
  `imageSources`**, not a sixth copy of the union. **An incomplete inventory is
  `null`, never a shorter list.**
- **PAGE + PHOTOGRAPH IN ONE REQUEST: IT BUYS THE PICTURE AND PLACES IT.** The
  line is WHO MAKES THE SLOT, the same line `runPictureEdit` draws with
  `needs-place`: a photograph asked for beside a page is a slot THIS change is
  writing. **A photograph ALONE is still the picture rung's, unchanged.**
  `PLACING_ADDS` is a third group and the partition stays total and disjoint;
  **`addLayerIn(kind, kinds, placing)` is the ONE reader** every route ask goes
  through (four calls, pinned by census), because two of them disagreeing is a
  kind designed and then reported as skipped. `IMAGE_CAP` and `MAX_PROMPT_CHARS`
  are IMPORTED. **The balance cuts the list before the writer sees it**
  (`imagesAffordable`, the same reader `buySitePhotos` asks at the moment of
  spend), so the writer is never shown a token the purchase will refuse.
  **Bought after the merge and the parts wall, before `newEmptySlots`**; billed
  on `made`, never `planned`. A photograph is `IMAGE_USD / CREDIT_USD` ≈ **18.75
  credits**.
- **⚠ AND THE SWEEP BELT WAS STRIPPING THE VERY TOKENS THE PURCHASE IS FOR.**
  `applyImages(aValid.pages, {})` ran unconditionally, which was right for every
  addon before today — the step bought nothing. *A rule true because of a layer
  below it expires when that layer moves*, and **here we are the layer.**
- **`unaffordable` IS HOW THE FULL LIST TRAVELS AND THE ROUTE NAMES THE
  REASON**, because it is the only place holding both numbers. **It is NOT
  `overflow`**, which is tokens the writer WROTE beyond the budget and which
  `applyImages` sweeps to `src=""` — so *"the other 2 pictures are
  placeholders"* is TRUE there and a lie here. **`frames` keeps the zero-budget
  sentence honest**: with nothing affordable the writer is asked for
  `<SafeImage src="">`, so *"the pictures are placeholders"* is true when it
  writes one and false when it does not.
- **IT ASKS FOR `src=""`, NOT A MISSING `src`.** The picture rung fills a slot
  by rewriting a `src` ATTRIBUTE, so the shape the addon used to ask for read as
  ZERO slots to the very next rung. An empty src and a missing one **render
  identically** (`safe-image.tsx` branches on `!src`).
- **BUYING ONE MAY NOT LOSE THE ONES ALREADY THERE.** `keptImages(before, after,
  slug)` — every photograph the site showed is still shown, or 422
  `lost-photos`, cost 0, before the purchase and before the gate. **Site-wide,
  never per file**, so a writer that moves a `<SafeImage>` between components has
  kept every picture the site shows. **The slug folds case and the URL does
  not**: the rest of the path is an R2 KEY, where a re-cased hash is a different
  object. **Replacement is removal.** `lostPhotosMsg` gives the COUNT and never
  the urls — a storage key tells a customer nothing.
- **A PHOTOGRAPH THE SITE ALREADY HAS MAY BE SHOWN AGAIN.** The capability was
  always there (a `/u/` url copied onto a new page passes `keptImages`, survives
  `applyImages` byte-identical, and adds no spend) and **the directive carried
  zero `/u/` urls in all three of its forms** while the sentence beside it read
  as an instruction not to. **A count cannot be copied into a `src`**, so the
  list and the permission arrive together or not at all: `urls` distinct, sorted
  (a prompt that moves for no reason is a cache miss and an unreadable diff),
  capped at `MAX_KEEP_URLS` (12) against a measured real-site maximum of 3.
- **A `src` THIS SITE DOES NOT OWN NEVER SHIPS.** `strayPhotos` is `keptImages`
  turned round — one function cannot answer both, because each is an addition as
  far as the other is concerned. **Swept to empty, not refused** (the
  `applyImages` precedent), asked BESIDE `keptImages` and before the purchase,
  and both lists written back into their own.
- **OWNERSHIP COMES FROM THE UPLOAD STORE, NOT FROM THE PAGES.** A picture
  nobody has placed is on no page, so building the owned set from `photoUrls`
  invented an upload made that morning. `siteUploadExists` HEADs
  `uploads/<slug>/<file>`; **three answers, and only `false` sweeps** — an
  unknown is LEFT STANDING, because an unknown left is at worst a broken image
  and an unknown swept is somebody's photograph gone. `before` is a fast path
  and not the definition. **A url the serve route itself refuses is a real
  absence**, and `uploadKeyFor` is the serve route's own shape rule, **resolved
  from the PATHNAME** (`new URL(raw, base).pathname`) so `?v=2` and `#preview`
  look up correctly and dot segments normalise the way the route normalises
  them. `/u/` is required BEFORE the parse, or `https://evil.example/u/…`
  resolves to a pathname the shape accepts. **The original URL is never
  rewritten.**
- **THE CORRECTION IS AN IMAGE REFERENCE, NEVER A STRING REPLACE.** `imageRefs`
  is the one definition, read by the FINDER and the CORRECTOR alike: a `src` as
  a JSX attribute or an object key, the kit's own naming in both places. An
  `href` is neither. The grammar is IMPORTED from `site-picture.mjs`
  (`KEY_BEFORE`, `keyName`), which is what stops `dataSrc` and `image_src`
  matching. A mismatched quote pair is refused rather than rewritten.
- **A DEPENDENCY IS COMPLETED OR WITHHELD, NEVER WARNED ABOUT.** A QR code
  pointing at a page that did not survive generation used to publish beside a
  sentence asking the customer please not to print it — **and a QR is the one
  thing here somebody PRINTS**. The whole dependent set goes together: the code
  is dropped and every page and component THIS CHANGE WROTE that renders it is
  withheld, an existing one reverting to its PREVIOUS version and an invented
  one not written at all. **Nothing breaks because what ships already shipped**:
  the binding is never deleted from a live page, it is never introduced.
  - **IT IS A FIXED POINT, NOT A PASS** — withholding an ADDED page takes its
    route away, which can kill a second code, which withholds a third page.
    `MAX_QRS` is 6, so a chain that long is constructible. **Re-merged, never
    patched**, because `mergeAddonPages` owns the link rule and a hand-edited
    answer satisfies none of it. **`validatePages` is asked AGAIN over what
    survives**, or a home page carrying `<Link to="/posters">` for a withheld
    page publishes with `TS2322` and a 404 for whoever clicks.
  - **NOTHING LEFT TO PUBLISH IS A REFUSAL** (`qr-dependency`, 422, cost 0) —
    a compile and a version for a site byte-identical to itself costs a build
    and moves nothing.
  - **A COMPONENT IS A GENERATED FILE TOO**, in both readers: since the band
    split a section IS `src/routes/-parts/<name>.tsx`. An **added** component
    that is withheld takes every page that IMPORTS it with it (publishing the
    importer without the module is `vite` refusing); a **changed** one breaks no
    importer. `PART_DIR` is the one definition; the leading `(^|["'/])` keeps a
    page called `my-parts/x.tsx` from reading as an import, and the trailing
    `(?![\w-])` keeps `qr-banner-2` from matching `qr-banner`.
  - **AND A SIBLING IS `./x`, WITH NO `-parts/` IN IT.** From inside `-parts/` a
    relative `./x` can resolve to NOTHING BUT `-parts/x.tsx`, so admitting it
    has a false-alarm rate of **zero by construction**; from a PAGE the same
    three characters mean another page, which is what `inPart` discriminates.
  - **`qrUnplaced` IS THE ONE READER of "does a page show this code"**, asked
    one source at a time against the WHOLE list, because its legacy `SITE_QR`
    arm keys on a code's INDEX — a one-element list makes every code look like
    the first.
  - **THE SAME DESTINATION, SPELLED TWO WAYS, GETS ONE ANSWER.** `cleanAdd`
    checked a destination against `going` **only when it `startsWith("/")`**, so
    a full URL to a route the site has not got was drawn, baked and published —
    **and the full URL is the spelling the tool offers FIRST**. `qrSiteRoute` is
    the one reader, shared with `deadQrs`; an external URL, a `tel:`, a `WIFI:`
    and a `mailto:` are none of our business.
- **A COMPONENT'S FILE PATH IS NOT A ROUTE.** `routeOf("src/routes/-parts/photo-wall.tsx")`
  answers `/-parts/photo-wall`, so a photograph in a component was bought,
  billed ~18.75 credits, published — and the same reply said *"Still to do"*.
  `routedSources(pages, parts)` answers `imageSources`' own list with a `routes`
  array: a page's is its own route, a component's is every page that imports it,
  **transitively**. Built from `imageSources` in two calls, so no index
  arithmetic ties the answer back to its input. **A page whose path is not a
  route contributes none.**
- **AN IMPORT IS NOT A PLACEMENT, AND A COMMENT IS NOT AN IMPORT.** Four shapes
  — a line comment, a block comment, a quoted example and a live-but-unused
  import — all read as placement. **`importSpecs` scans `codeOnly`** (the
  comment half) and **a specifier is a string literal by POSITION**, after
  `from`/`import`/inside `import(`/`require(` (the quoted half) — *a substring
  test cannot express that at all*. **`codeOnly` lives in `site-files.mjs`** and
  `site-picture.mjs` re-exports it, asserted the same function by identity.
  **The compile question and the placement question are two**: a dangling import
  breaks `vite` whether or not anything renders it, so the cascade keeps
  `importsPart`; `partUses` answers `rendered` / `unused` (the one definite
  negative) / `unsure`. **The direction is asymmetric on purpose** — reading a
  placed component as `unused` costs a false "Still to do".
- **AND A NAME INSIDE A STRING IS TEXT ON THE PAGE, NOT A PLACEMENT.** The
  placement test (`<Name`) reads the **masked** copy and the mention test reads
  the **code** copy, and that asymmetry is the whole correction: real JSX
  survives masking (`<Band title="a <Band /> example" />` keeps its own opening
  tag), while masking the mention too would call a binding referenced only in
  `` `${Band}` `` a DEFINITE absence — `scanSource` masks a template literal
  WHOLE.
- **`routes` IS ESTABLISHED PLACEMENT AND `maybeRoutes` IS WHAT COULD NOT BE**,
  `min` along each path and `max` across them, and a route in one is never in
  the other. The three readers take `routes` for positive evidence and neither
  answer for uncertainty — **`appliedFacts` has exactly two words**, so an
  unestablished placement was being recorded as `fails: ["onpage"]`, the
  strongest negative this vocabulary has, over evidence that establishes
  nothing.
- **A PICTURE A PAGE DRAWS FROM A LIST WAS COUNTED BY NOTHING.** `imageSlots` is
  RIGHT not to see a `<Gallery items={[…six…]}/>` — its contract is a `src` SPAN
  to replace and a LITERAL `alt` to match — but **the customer's sentence is
  about what they SEE**. Over the 100-site corpus that is **320 such frames in 60
  of 324 files, and EVERY ONE IS EMPTY** (254 explicitly `src: null`, 66 with no
  picture key, zero carrying a url or a token). The rule is `alt`, the kit's own
  `{src?, alt?, caption?}` as object keys, so `listFrames` knows nothing about
  which components exist. **A COUNT IS ESTABLISHED ONLY WHERE THE ARRAY IS THE
  PROP'S WHOLE VALUE** — measured, **297 of the 320** are in that shape — and
  everything else (a named const, a call, a memo, a spread, a ternary) is
  uncertainty, which reaches the customer with **no number at all**. A deny-list
  of runtime methods caught **ZERO of the 23**, because a generated page declares
  its array at the top of the file and maps it two hundred lines below.
  `MAX_PROP_LOOKBACK` is 2000 and **the 815 is measured** (the furthest a counted
  entry sits from its own `items={`); a bound reached is uncertainty, never a
  number.
- **AN OBJECT INSIDE A STRING IS AN EXAMPLE** — two views of one file, because a
  frame is FOUND by its braces and READ by its values. `codeOnly(src, true)`
  blanks contents and KEEPS the quotes. **⚠ The first cut destroyed 29 real
  frames across 6 corpus sites**: JSX text is full of apostrophes, and read as
  string openers they swallow a whole `<Gallery>` two hundred characters below.
  `AFTER_WORD` (`/[A-Za-z0-9]$/`) is the fix — a string never opens directly
  after a letter or digit — **with a BACKTICK exempt**, because `` css`…` `` is
  a tagged template.
- **`newEmptySlots(before, after)` IS PER PAGE AND ONLY THE INCREASE**, computed
  AFTER `applyImages` over the PUBLICATION (not the writer's answer), so a page
  the QR dependency withheld is not counted. **Negative never subtracts**; a
  `src`-less element is not a frame anybody can fill; and an unreadable
  component store takes components off BOTH sides, never one.
- **A SCENE'S DECLARATION AND ITS PLACEMENT ARE TWO FACTS.** `three` is a stored
  look field decided by the design step and the canvas is written by the page
  step, so `sceneOn` (beside `sceneDirective`) requires **both** the import and
  the element, the conservative direction.
- **A PHOTOGRAPH'S IDENTITY IS ITS `name`**, a label the designer coins, not a
  binding: `describe` is capped at 240 and an `item` at **80**, so a designer
  echoing a real brief would have it silently truncated. **Required, not
  optional** (an optional identity leaves the collapse reachable in the ordinary
  case) and **refused rather than sliced** (a sliced brief is still the picture
  somebody asked for; a sliced NAME is a label the designer never wrote). Two
  pictures in one answer may not share a name. **The chain is request → token →
  url → file → route** and `shotKey` is the ONE normalisation both ends ask.
  **The wall fires only where something else would answer for it** — a lost
  request on a route carrying no photograph is already `absent` and earns the
  better clause.
- **A PARTIAL OUTCOME IS SAID.** `droppedNote` joins `coverNote` beside
  `missingPagesNote`: a thing the design asked for and this step could not build
  is a fact about the change whether or not a requirement named it. **Counts and
  kinds, never the identifiers** — `tide-chart` is a file name the DESIGNER
  coined. The kind is said in the customer's vocabulary (a component is a
  *section*, a column a *field*) and an unrecognised one is a *thing*, which
  fails open.
- **A REFUSAL STORES NOTHING ON ITS WAY OUT.** `patchSiteConfig` ran ABOVE
  `keptImages`, so a combined gallery + photo + QR request failing `lost-photos`
  left the QR persisted for a route that will never exist. **Moved rather than
  compensated for** — a restore-on-refusal is a second repair path that can
  itself fail — which keeps ONE rule (*a refusal changes nothing*) instead of a
  rule plus an exception, and makes the store-to-publish window strictly
  SMALLER. The store's own comment read *"every refusal above leaves the site
  exactly as it was"*, which was TRUE when written and is why nobody looked.

### AN OUTSIDE CONNECTION A PAGE CAN ACTUALLY RENDER (2026-09-19)

Of every gap in the `api` tier this was the only one where **the page provably
cannot be written correctly from what it is given**. Three pieces, in the order
they fail: **`returns`** (a sketch of the answer's SHAPE), **`params` with types
and required flags**, and **`credential`** (which service, and where the owner
signs up).

**A TYPE ANNOTATION CHANGES NOTHING A VISITOR SEES**, and this is measured, not
argued: two `.tsx` pages differing only in `useApi<Rates>(…)` against
`useApi(…)`, built with the template's own esbuild, are **408 bytes each,
sha256 `73a4782b79a186d0`, byte-identical** — with both asserted NON-EMPTY
first, because esbuild answers zero bytes on a bad flag and two empty files are
vacuously identical. **And an invented type cannot catch a wrong field name,
because the same guess produced both**: `type Rates = {rate: number}` reading
`q.data?.rate` **typechecks CLEAN under `tsc --strict`** and renders `""`
against `{rates:{current:{gbp:0.79}}}`. **The failure is the field name and the
type is what stopped anybody noticing** — so `TS2339` is evidence of a typing
problem and never of blank rendering.

- **`site-api-shape.mjs` IS THE ONE DEFINITION** — dependency-free, at the root,
  on the Dockerfile's worker line. `site-apis.mjs` keeps the REQUEST (fill,
  call, cache); this keeps the three things a page writer needs and could never
  discover.
- **THE SKETCH IS A TREE OF TYPE NAMES AND NEVER A SAMPLE.**
  `{"current":{"temp_c":"number"}}` says which field to read;
  `{"current":{"temp_c":18.5}}` is a sample, and a page written against one
  hardcodes today's answer (`shape-leaf`). A list is a ONE-ENTRY array; two
  entries say two things. `unknown` is a real leaf. Depth **5**, **60** nodes.
  **`typeFromShape` is what makes it actionable**, and a key that is not a plain
  identifier is QUOTED or the type does not parse.
- **`SHAPE_TOP` IS THE ONE DEFINITION AND THE TOOL'S TYPE IS DERIVED FROM IT.**
  The tool said object-only while `cleanShape` accepted a top-level ARRAY — what
  most list endpoints send — so a model obeying the schema could not describe a
  list at all. **A bare leaf is out on purpose** (`shape-top`): `returns: "a list
  of exchange rates"` is what a model writes reaching for prose.
- **THE SKETCH'S OWN FIELD NAMES MUST BE PERMITTED ON THE WIRE.** xAI's
  documented tool-schema rules default `additionalProperties` to false, and
  `toXaiRequest` passes `input_schema` VERBATIM — so a declared object with no
  key permission admits **no keys at all**, and a sketch is nothing BUT
  arbitrary field names. **The permission sits where a type is declared, and
  that is one place**: the array branch declares no `items` so its entries are
  unconstrained, and below the root nothing declares a type. A belt at either
  would be a keyword that constrains nothing. **This is the repository's first
  type union AND its first `additionalProperties` permission**, in ONE place so
  a live 400 is a one-line flip. **The reach is the `api` ADDON kind and a
  design call that carries `backend` — a revise — and NO first build**, because
  `FRONTEND_SCHEMA_TOOL` destructures `backend` out. Measured; the first
  write-up of this overstated the blast radius twice.
- **`params` STAYS THE LIST OF NAMES AND `paramInfo` SITS BESIDE IT**, because
  `declFingerprint`, `cacheKey` and `takeParams` all iterate `api.params` as
  names and changing the shape would re-key every cached answer on the platform.
  One walk produces both. **Re-reading a stored declaration must put the two
  back together** — `cleanParams(params, stored)` pairs **BY NAME**, never by
  position.
- **NONE OF THE THREE IS IN THE CACHE FINGERPRINT.** Correcting a parameter's
  description would otherwise drop every cached answer and put the owner's
  third-party quota back on the next page view — a documentation fix billed as a
  configuration change. The parameter NAMES stay in it.
- **A REQUIRED BLANK IS REFUSED BEFORE THE UPSTREAM CALL.** Without it `fill`
  substitutes an empty string and plenty of services answer 200 with a default,
  so the page renders something plausible and wrong.
- **WHERE THE KEY COMES FROM IS DERIVED FROM THE DECLARATION, NEVER CLAIMED.**
  `credentialNote` reads `secretsNeeded` — the declaration's own `{{SECRET}}`
  placeholders — **asked PER CONNECTION**, so a mixed request cannot tell the
  owner to sign up for a key nothing will use, and misleading metadata on a
  keyless connection is ignored rather than believed. It must not say a keyless
  connection *"is answering already"*: this platform has not called that service
  and has no business saying it works; what it knows is that there is nothing to
  paste. `secretsNeeded` lives in `site-api-shape.mjs` and `site-apis.mjs`
  RE-EXPORTS it, asserted the same function by identity.
- **THE PAGE IS TOLD IT HAS THREE STATES TO DRAW.** The word "loading" did not
  occur in `builder/page-gen.mjs` at all. A database read is local; a
  third-party read crosses the internet, answers 503 until the key is in the
  vault and 502/504 when the service is down. **That sentence is new for EVERY
  connection**, so the per-connection LINE is unchanged for a connection that
  declared none of the three and the block gains one shared sentence.
- **THE TOLERANT READER AND THE REFUSING CLEANER.** `normalizeApi` is what every
  STORED spec passes through on its way to being served, so a sketch it cannot
  read is DROPPED and the connection still works; `cleanAdd` refuses by name at
  the moment a person can be told. One definition of clean, two decisions.
- **THE JOINED ACCEPTANCE IS THE CLAIM THE THREE SEPARATE ONES CANNOT MAKE.**
  Between the page and the service sit two hops nothing had ever run together —
  the url `useApi` builds and what the platform's own route does with it — so
  the page goes through the REAL addon route, is read back **out of the store**,
  and that exact string is rendered with the kit's own `useApi` against
  `worker.js`'s own `/api/db/<slug>/api/<name>`. **This proves LOCAL WIRING
  only**: the service is stubbed, and neither documented compatibility nor local
  validation is provider acceptance.
  **⚠ AND THAT LAST SENTENCE IS NO LONGER THE WHOLE STORY — RUN 53 SUPPLIED THE
  MISSING HALF.** The acceptance test stubs the service because it must; run 53
  did not. A published page on `repairbench-1` called the REAL keyless rates
  service through this exact chain and rendered its answer — `1.1644 / 1.3344 /
  Rates from 2026-09-18`, read at TWO depths (`date` at the top level, `EUR`
  inside `rates`), with zero console errors. **So provider acceptance IS
  established for one keyless connection**, and what the stub sentence still
  correctly guards is the general claim: one service answering is not every
  service answering, and a KEYED connection remains unproven.
  **THE TRAP THIS ENTRY WAS CAUGHT BY**: the run that proved it is written up
  three hundred lines above, and the capability table went on saying *"NO page
  has ever read one live"* for a day — **the file falsified itself and neither
  half noticed**, exactly as the `language` entry did. When a run proves
  something, the CAPABILITY SUMMARY is the thing to edit; the narrative is
  where nobody checks a claim.
- **KEPT RECORDED, NOT FIXED**: native one-time scheduling for a job, which
  shipped 2026-09-19.
