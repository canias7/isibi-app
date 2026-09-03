# The steps, and the site at the centre

> The owner's own drawing, 2026-08-29. **The SITE is the centre of this system,
> not the paths.** One step builds it; the others act on it, and every one of
> them publishes back into it through the same spine.
>
> Read this before adding a step, and before "just reusing" the designer for one.

```
                          GOFARTHER
                              │
                          ┌───────────┐
              STEP 1 ───► │ BUILD     │  design_schema — 19 fields, 84.8k
                          │  design   │  ✅ its own tool, its own wording
                          │  generate │
                          │  compile  │
                          └─────┬─────┘
                                │ publish
                                ▼
                        ╔═══════════════╗
                        ║     SITE      ║ ◄─── everything publishes back here
                        ╚═══╤═══╤═══╤═══╝      through ONE spine
                            │   │   │          (recompileAndPublish)
              ┌─────────────┘   │   └─────────────┐
              │                 │                 │
          publish            publish           publish
              │                 │                 │
        ┌─────▼─────┐    ┌──────▼─────┐    ┌──────▼──────┐
        │ EDIT STEP │    │ ADDON STEP │    │ DELETE STEP │
        │           │    │            │    │             │
        │ ✅ SPLIT   │    │ ✅ SPLIT   │    │ ❌ NOT A    │
        │  2026-08-29│    │  2026-09-02│    │  STEP AT    │
        │           │    │            │    │  ALL        │
        │ pick_lanes│    │ pick_adds  │    │             │
        │  = THE    │    │  = WHICH   │    │ it's a flag │
        │  FRONT    │    │  KIND of   │    │ (remove:    │
        │  DOOR for │    │  thing     │    │  true) on   │
        │  all 21   │    │     ↓      │    │ page + logo │
        │     ↓     │    │ 5 act here │    │             │
        │10 act here│    │ 1 dispatch │    │             │
        │ 9 dispatch│    │  (photo)   │    │             │
        │ 1 verb    │    │ then the   │    │             │
        │ 1 escalate│    │ page call  │    │             │
        └───────────┘    └────────────┘    └─────────────┘
```

**Status of the split (2026-09-02).** `EDIT` is done — twenty-one lanes, all
acting. `ADDON` is split too, the same way (`builder/site-add.mjs`, below):
its own picker, one small designer per kind of thing a site can lack, and the
build's designer never called from it again. `DELETE` is deferred — owner's
call: *"we are gonna worry about delete later"*.

**Where the line between EDIT and ADDON sits (owner, 2026-09-02).** *"Add will
always go in addon"* — and *"tsx does exist tho, is literally everything on the
page, it could be changing a component, is changing tsx"*. So the line is at the
**thing**, not the page: does what the customer names exist on the site now?
It does — EDIT changes it (words, colours, stylesheet, button, menu, pictures,
languages, what a control does, and the page's own code). It does not — ADDON
makes it (a page, a table, a section, a QR code, a 3D scene, a photograph where
there is none). Before this the line sat at the page: "add a testimonials
section to the home page" was an edit because the page existed. Four hops carry
the new line, and each is guarded in `test/add-goes-to-addon.test.mjs`:
the router's wording (`site-ask.mjs`); a wall at the edit route's picker that
refuses to *create* a `qr` or a `three` the stored look lacks and escalates
with `layer: "addon"`; the browser's `escalateAction`, which answers `addon`
for that layer and runs the addon route (before, every escalate that was not a
sideways hop fell to the ~25-credit revise, so the middle rung was unreachable
from an edit); and the addon step itself, which now keeps the look it designs
(`mergeLook`, stored just before the publish, reverted on a failed one), tells
the page call the bindings, hands parts to the spine, and no longer refuses a
site without a database — a first build provisions none, so that refusal had
sent every "add a QR code" on most of the platform to a rebuild. A table
designed for such a site is a named refusal, not a climb. The addon called the
build's designer until later that day; it has its own step now (below).

---

## Why the steps must not share the designer

The `look` lane called `designSiteSchema` — the BUILD's function, with the
build's tool and the build's system text — to change one colour on a live site.
That is 84,817 characters of instructions for inventing a business from nothing,
eleven sentences about which access level a table should have, and nineteen
properties of which eighteen the change had no business opening.

**And the two framings then fought, which is the half that cost real money.** The
build's `css` description opens *"ONLY WHEN ASKED … OMIT this field entirely
unless"* — right for a first build, and read by a customer's edit as *don't touch
the stylesheet*. `EDIT_RULE` had to NAME that clause and overrule it in prose,
because both arrived in the same call. Two steps means the sentence is never sent.

Owner, 2026-08-29: *"it should be 2 separated path tho, idk why you are mixing
the build with the edit path"*, and on what the edit step IS: *"customer says
edit this, and booom you go edit it"* — pure action, no design round.

---

## The EDIT step — `builder/site-lanes.mjs`

Its own module. **It imports nothing from `worker.js`**, which is what makes the
separation a fact about the code rather than a claim about it.

```
  customer ──► pick_lanes ──┬──► edit_site ──┐        8 lanes, here
               haiku        │   one per lane │
               ~3.5k        │   1 property   │
               17 names     │   0 required   │
               + a verb     │                │
                            ├──► picture / nav / rules / page       6 lanes
                            │                │
                            ├──► page (remove | move) · addon (add) 1 verb lane
                            │                │
                            ├──► escalate to `build`                1 lane (kind)
                            └──► escalate, unbuilt                  1 lane (slug)
                                             ▼
                                        ONE PUBLISH
                                     per message, always
```

**Every lane the customer named runs.** Two asks run two lanes in turn (owner:
*"run both lanes in turn"*), each shown only its own field's stored value so they
cannot collide. A lane whose work lives on another rung dispatches there; the
front door took the FIRST dispatched lane and dropped the rest until 2026-08-29,
so "darker footer and swap the shop photo" silently lost the footer.

**ONE PUBLISH PER MESSAGE** (owner: *"for the publish is per act — if the act was
2 things then 1 publish; if the act was 2 things but one thing first then the
other, then is 2 publish"*). The eight branches call `publishStep`, which collects
pages and answers success; the real spine runs once below the loop, with the
source every step contributed to. `eSrc` carries forward between rungs, or the
single publish would ship whichever step ran last.

### The seventeen lanes — ALL of them act (owner, 2026-08-29)

> *"i need all the 17 lanes acting"*

Nine were refused at the door: named, priced at zero, sent up the ladder. Honest
about what this module edits, **wrong about the customer**, who asked for a
change and got a fall-through — and unnecessary, because six of the nine already
had cheap, shipping implementations one lane over. Nothing was missing but the
wire. So **`pick_lanes` moved above the layer dispatch** and is the front door
for all seventeen; what it names decides which layer runs.

| | lanes | where the work happens |
|---|---|---|
| **8 act here** | `css` `theme` `brand` `description` `wordmark` `favicon` `lang` `langs` | one tool, one property, 1 credit |
| **6 dispatch** | `images`→`picture` · `action`→`nav` · `backend`→`rules` · `shape` `components` `purpose`→`page` | that rung's own price, 0.3–3 |
| **1 verb lane** | `pages` — `remove`/`move`→`page`, `add`→`addon` | the router answers WHICH of the three |
| **1 escalates** | `kind`→`build` | a rebuild is what it is; the rung above does it |
| **1 unbuilt** | `slug` | a real address change — redirects, custom domains |

The eight are plain strings, enums or lists of short strings — which is why this
module owns its own shapes and shares none. The six **dispatch** because a stored
plan is read by nothing: the container gets the pages, the theme and the
stylesheet, never the plan. `shape` is not a value to save, it is a job for the
rung that rewrites pages. The three groups are a **total, disjoint partition**,
asserted in `test/edit-lanes.test.mjs` — a lane in no group is a request that
falls out of the door; a lane in two behaves differently depending on which check
runs first.

**Every field the design tool can produce has a lane**, so no part of a site
becomes unreachable — asserted in BOTH directions, because a field added to the
build with no lane is a part of a site the customer can never change again, and a
lane for a field the build stopped producing edits nothing. Neither announces
itself.

**Three things the wiring exposed:**

1. **A photo edit no longer needs a stored look.** The door runs before each
   layer's own gates, so "swap the shop photo" on a look-less site goes to
   `picture` instead of being refused `no-look` by a lane that was never going to
   handle it.
2. **A dispatched lane carries no page.** `shape`/`components` had nothing to
   edit until `ePage` defaulted to the site's only page — most sites, since the
   plan caps a new build at one — or home.
3. **The `page` lane was dead on every frontend-only site.** Its `_meta` read was
   ungated, so `sqlQuery(null, …)` threw and it escalated `no-meta`: the same gate
   class as `look`/`logo` (fixed 2026-08-28), one rung up and missed then. It
   surfaced only because three lanes now dispatch there. `{ tables: [] }` is the
   truth about a frontend-only site; `null` is kept for a site that HAS a database
   whose `_meta` could not be read, because cannot-tell must never read as
   nothing-there.

**Two of the three "unbuilt" lanes were not missing capabilities — they were
missing a word.** `pages` add/remove/move all already existed, on three different
rungs; the lane simply could not say which, so it escalated under one name for
three jobs. The router now answers a VERB beside the lane. **No default**: an
unreadable verb refuses, and this is the one place in the edit path where the
bias inverts — everywhere else an unclear answer resolves to work, because a
wrong action costs a change the customer can see and undo; here it can cost them
a page. A verb aimed at a page the site does not have is `no-page`, checked
against the real route list.

`kind` **escalates to `build`** rather than dispatching, because `build` is not
an edit layer — the guard asserting every dispatch target appears in
`EDIT_LAYERS` caught the first attempt to make it one, and a lane pointing at a
rung no dispatch matches is a request that vanishes.

**`slug` alone is genuinely unbuilt**: claim the new name, republish the Worker
under it, redirect the old address, keep every custom domain pointing at it.

### The wall, not the rule

A `css` lane cannot re-theme or rename a site — **not because it is told not to,
but because the tool has one property and there is nowhere to put the answer.**
That is the difference between a rule and a wall, and this repo's record is that
a rule in prose is one a model eventually reads past.

### What it costs

| | before | after |
|---|---|---|
| tool on the wire, css edit | 84,817 chars | **4,012** (router 2,811 + lane 1,201) |
| credits | 1 | **1** |

`pageCredits` is variadic and rounds ONCE with a floor of 1, so the second call
adds no credit. 95.3% off the wire on the commonest edit there is.

### Every prompt in there is a placeholder

Owner: *"i will tell you the prompt later"*. Each lane has one `hint` (how the
router recognises it) and one `edit` string (what the acting call is told), both
in the `LANES` table in `builder/site-lanes.mjs`. Swapping the wording in is a
find-and-replace, not a refactor. `EDIT_SYSTEM` and `PICK_SYSTEM` are the two
shared blocks and are marked the same way.

---

## The ADDON step — `builder/site-add.mjs` (split 2026-09-02)

Its own module, the edit step's shape. **It imports nothing from `worker.js`**
and nothing from the build's tool; what it shares with the build are SHAPES
from the modules both paths may read — the table item (`TABLE_ITEM`, lifted
out of `design_schema` into `builder/site-table.mjs` for exactly this), the
hand-written-part item (`TSX_ITEM`) and the kit's menu — never a description.

```
  customer ──► pick_adds ──┬──► add_to_site ──► [make the database] ──► the page call ──► ONE PUBLISH
               picked model│    one per kind      first touch only      (addon mode:
               1.9k chars  │    one property      then apply the        returns only what
               9 kinds     │    0 required        backend               is new or changed)
                           │                                          a job alone: no page call, no publish
                           └──► picture                 ← photo, one hop sideways
```

**Nine kinds, the intent router's own list**: `table` · `function` · `api` ·
`job` · `page` · `component` · `qr` · `three` act here, `photo` dispatches to
the picture rung (the one that places a photograph and prices it; this step
never buys one). Order is run order — a table before the function that reads
it, both before the job that runs the function, all before the page that
shows them. Each acting kind has a four-part rule (`is` · `yours` · `wide` ·
`keep`), a shape of its own, and a tool with ONE property and nothing
required, so a kind that cannot answer returns nothing and the route says so.

**The backend is the addon's, and a site gets its database on first touch**
(owner, 2026-09-03: *"the build step doesnt have backend so its gonna be on
the addon step if needed … if customer touches it then neon db is
created"*). A first build sends none of the four backend tiers, so every
function a page calls, every outside service a page reads live and every job
that runs on a timer is added HERE — three more kinds beside `table`, each
the build's own item shape (`FUNCTION_ITEM`, `API_ITEM`, `JOB_ITEM`, lifted
into `builder/site-table.mjs` beside the table's and bound in the build tool
by identity) in this step's framing. The first of any of the four designed
for a site with no database MAKES the database, through the build route's
own call (`ensureSiteBackend`: the slug's project, claimed atomically, auth
and the Data API enabled, idempotent on a retry), before the schema is
applied to it; a failed provision is a named 502 that is ours, nothing
charged, nothing changed. The two `no-database` refusals are gone. Then the
engine's own reader (`normalizeSchema` → `applySiteSchema`) adds what is new
and leaves what is there, a function is `CREATE OR REPLACE`d, the jobs are
registered by the build route's own `persistSiteJobs`, and the reply says
what the engine really MADE — `functions` (only the ones that created),
`apis`, `jobs`, `functionErrors` by name, `needsSecrets` (every `{{SECRET}}` a
new connection wants pasted under Cloud → Secrets), `provisioned`. **Each kind
is its own call, so the job designer has to be told the function the function
designer just declared**: the route appends designed functions to the site's
lists as they are cleaned (`jobFns` for the internal ones — the only kind the
engine lets a job run), the note prints them, and `cleanAdd` admits a job
only against that list. A job naming a STORED internal function is
re-attached after `normalizeSchema` (which keeps a job only when its function
is declared in the same spec, and a stored function has no body to re-send).
The function designer is shown each table WITH its columns (`name type`),
because a `sql` body is parsed at CREATE and a guessed column is a function
that does not exist. **A job, or an internal function alone, changes no page**
(`pageless`): the route bills the small calls through the one charge
(`aCharge`, shared with the page path) and answers without a compile, the
site's pages exactly as they were. Not proven live yet — the addon harness has
a case per kind (`function`, `api`, `job`, judged off the reply's own evidence
because a database leaves no mark on the page), and the provision needs a
frontend-only site on the allowlist, the owner's call.

**Jobs, designed first (owner, 2026-09-03).** Three decisions built. The
runner sends now: three of its deps read the site's Neon *project row* where
the *database connection* was wanted, so every job ever registered wrote
"this job is no longer part of the site" and nothing was ever sent; all three
read the connection now, through one `jobDeps` shared with the owner's
"Run now". A clock time: `everyMinutes` alone turned "every day at nine"
into "every 1440 minutes from whenever it was added", so a daily-or-slower
job may carry `at` ("HH:MM", the site's local time), the owner's browser
sends its zone with the addon and the route stamps it on the job, and
`dueJobs` runs a clock-time job once its latest occurrence is behind now
and after its last run — or after it was registered, for one that has never
run, so a 09:00 added at three in the afternoon waits for the morning. Run
now: `POST /jobs {name, run: true}` runs one job at once on the same deps,
the stamp landing without the dueness clause, the outcome written where the
panel reads and answered as the sentence; the panel has the button beside
the On/Paused switch. Delete stays on the edit path.

**The backend services round (owner, 2026-09-03: *"ok add those"*).** Four
platform pieces beside the addon, none a model step. A CSV into one table:
`site-csv.mjs` reads the file (quotes, line breaks inside them, a BOM, Excel's
semicolons; a cell read as its column's type, day-first dates) and
`handleOwnerImport` writes it through the owner's own door — never a
member-written table, a hundred rows an INSERT, a refused batch retried a row
at a time so the bad line names itself — behind **Import CSV** beside **+ Add**
in the Data panel. One submission, once: `useCreateRow` and `useCheckout` send
an `Idempotency-Key` renewed only after a success, and the data proxy and the
checkout route hand a repeat the answer they already gave (`site-idem.mjs`, an
in-isolate map plus KV). A job may DO something: a function answering
`{"did": "…"}` reports work done instead of reading as broken SQL, which is
row expiry on a timer. Members finish a reset on the page that asked
(`resetToken()`, `useResetPassword`) and verify an address by code
(`useSendVerification`, `useVerifyEmail`), the contract read off Neon's and
Better Auth's docs. The inbound webhook signature check was already in
`site-inbound.mjs`.

**A site carries several QR codes** (owner, 2026-09-03: *"it should carry
more"*). The stored field is a list of named codes, `{ name, points, label }`,
each drawn to its own file (`qr-wifi.svg`) and reached by name
(`SITE_QRS.wifi`); the old single code reads as one entry named `qr`, keeping
`qr.svg` and `SITE_QR`, so nothing published before the list changes. The
addon APPENDS a code and refuses only a duplicate — the same name or the same
destination as one the site has — so `three` is now the one thing a site
carries one of (`SINGLE_FIELDS`). The edit lane answers a PATCH to one code by
name, never the list (a model handing back a list can drop an entry, and a
dropped code is a printed card that stops working), folded over the stored
list in the Worker; the page step that places codes asks for exactly the ones
no page shows, by name. `builder/site-qr-list.mjs` holds the names, the files
and the reader, dependency-free because the container imports it too.
**Proven live on run 29 (2026-09-03)**: fretwork-1 serves `qr.svg` (rings the
number) and `qr-prices.svg` (opens `/prices`), added by one sentence for 13
credits. The three declines before it each named a fact the addon's designer
had not been told — the site's address, what each page calls itself — and the
designers' raw replies are kept now, so a decline is read rather than guessed.

**A section is a component** (owner, 2026-09-02: *"section is just adding a
new component, so its a tsx step that adds components"*). The page is a tsx
file made of components, so what a customer calls a section, a form, a map or
an FAQ is a component the page does not have yet: the kind names it — a kit
part by name, or one written for this site — and where on which page, and the
page call puts it in the tsx. An answer naming no component is refused.

**What was mixed, and what it cost.** The route called `designSiteSchema` —
the build's 93,852-character tool anchored on the stored look — and read four
fields off the answer (`tables`, `qr`, `three`, `tsx`). The plan it designed
for the addition (purpose, sections, components) was thrown away; the page
call got the customer's sentence and no plan. Now the fold (`foldAdds`) hands
the page call a directive for the addition and the union of kit parts through
`plan.components`, so the page writer is shown their exact props — the build's
own design→page shape at an addition's size. On the wire: **1,936 characters
of picker + one small tool (1,299 for a scene, 1,570 for a code, 20,045 for a
table, ~35,000 for a page or a section, most of which is the kit's menu)**
against 93,852.

**Two rules from the owner (2026-09-02).** Universal: *whatever is added
keeps the site's design system* — theme, stylesheet, typefaces, colours,
shape of page, kit parts, conventions; it slots in and nothing about the look
is re-decided. One string (`ADD_DESIGN_RULE`), sent to both models that have
to hold it: the designers and the page writer. And *no low limits while
testing*: a message may name every kind it asks for, and pages, components
and tables answer LISTS capped only at what a site can hold (six pages — the
page writer keeps six — twelve components, six tables), each rule reading "as
many as they asked for, and not one more". An entry that cannot be added is
left out and named in the reply; the rest go in.

**Refusals are sentences, never climbs**: a scene the site already carries
(read the way the edit route's wall reads it — the stored look OR the page
source), a page the site already has, a code with no real destination or a
duplicate of one it has, a function with no body, a connection that is not
https, a job naming a function the site may not run. Every one is a named 422
with the door that does change it; only a picker that names nothing escalates
to the revise. (A table on a site with no database was one of these until
2026-09-03; it makes the database now.)

**Every prompt is a placeholder** (owner: *"i will tell you the prompt
later"*), marked so in the module, one `hint` and four rule parts per kind.

**Queued, the way the EDIT step is (2026-09-03).** Run 21 — the first addon
fired on the live site — was reset at 257.6s on the customer's connection:
the ~273s wall the edit step left on 2026-09-01, on the one route that had no
queue fork. The addon route now files a job through the same queue (under its
own `op`), the same consumer replays the stored POST, the same poll route
hands back the stored reply, and the same flag and allowlist decide whether a
site is on it. Inside the replay the route runs exactly as it does
synchronously, with the job's clock on every model call, cancel and budget
re-asked before the page call and before the publish, the bill reserved
before the publish (the spine's gate grants only a billed or exempt job) and
the spine handed the job. The browser watches the receipt through the one
watcher with the addon's own reader; the harness sends a retry key and
watches the same way.

**Proven live on runs 22–25 (2026-09-03), every kind**: `component` (a
testimonials section on fretwork-1, published 5m36s after the receipt for 12
credits), `page` (`/prices` over the site's own lessons table, 6m39s, 13),
`three` (a guitar you drag to turn, 8m14s, 12) — each filed as a job and read
off the served page; `qr` refused honestly while a site carried one code
(before the list above); `photo` hopped to the picture rung, which answered
`no-slots` on a site with no photograph (a gap, filed). `scripts/addon-sweep.mjs`
(`harness: addon` in `lane-sweep.yml`) is the instrument, and every "LIE" it
printed was the instrument — each is a case in `test/addon-sweep.test.mjs`
now. The `table` kind has not been asked on a site that can take one.

## The DELETE step — does not exist as a step

`remove: true` rides on the edit router (`REMOVABLE_LAYERS`) and reaches exactly
two things: a whole page, and the logo. A section, a component, a table, a
language or a photograph cannot be deleted — those fall through to the ~25-credit
full rewrite, which is also the rung least likely to actually delete anything
(measured three times: asked to delete a page, the page model rewrites the site
and never sets the field that deletes one — which is why the ROUTER decides it).

Deferred by the owner, 2026-08-29.
