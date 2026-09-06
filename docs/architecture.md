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
              STEP 1 ───► │ BUILD     │  design_schema — 23 props, 93.6k
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
        │     ↓     │    │ 8 act here │    │             │
        │10 act here│    │ 1 dispatch │    │             │
        │ 9 dispatch│    │  (photo)   │    │             │
        │ 1 verb    │    │ then the   │    │             │
        │ 1 escalate│    │ page call  │    │             │
        └───────────┘    └────────────┘    └─────────────┘
```

**The one number in the drawing, measured rather than remembered
(2026-09-06).** `design_schema` is **23 properties, 15 required, 93,598
characters** of tool on the wire — evaluated out of `worker.js` through
`test/integration/schema-tool.mjs`, not read off a comment. A FIRST BUILD sends
22 of them (14 required, 64,076 chars): `FRONTEND_SCHEMA_TOOL` destructures
`backend` out and filters it from `required`, so the two can never disagree, and
**`backend` alone is 29,501 characters — 31.5% of the tool** that never goes out
on a build. The drawing said 19 fields and 84.8k, which is what it was on
2026-08-29; re-derive before quoting either.

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

## The doors — every route that reaches a step

> Added 2026-09-06, the same drawing one level down. **The site is still the
> centre**: these are the doors, and every one of them ends at the same spine.
> Derived from `worker.js`, not from memory — the matchers are all in one
> block and `test/api-auth.test.mjs` holds the list against them.

```
                      the customer types one message
                                    │
                     POST /api/site/route          ← THE FRONT DOOR
                     the picked model's `quick` slot
                     billed ONCE per message, never per rung
                                    │
             ┌────────────┬─────────┴─────────┬────────────┐
             │            │                   │            │
         "build"   "edit" + one of 9      "addon"      "ask" /
             │       layers + a verb          │       "clarify"
             │            │                   │            │
             ▼            ▼                   ▼            ▼
   POST /api/site/  POST /api/site/   POST /api/site/   prose back,
    react-build      <slug>/edit       <slug>/addon     nothing
    (= /build                                           published
    = /react-revise)  ── the ladder ──  ── 9 kinds ──
             │            │                   │
             │            └─────────┬─────────┘
             │                      │
             │            202 { job } ──► GET    /api/site/edit/<job>   poll
             │                            DELETE /api/site/edit/<job>   cancel
             │
             └──── 202 { job } ─────────► GET    /api/site/build/<job>  poll

  ══════════════════════════ AND ALL OF THEM END HERE ══════════════════════
        recompileAndPublish  →  compile  →  afterCompile seam  →  stage
        →  edit_may_publish  →  activate the pointer  →  the script  →  commit
```

**One activation, three callers.** `recompileAndPublish` is the spine for EDIT,
ADDON, the platform rebuild and the free text rung; `buildAndPublishPages` is
the build's own; `restoreVersion` is a rollback. All three end at the same
`activateBuild` in `site-builds.mjs`, which is the single place a site changes
what it serves — so anything a build bakes, every other door bakes too, and a
typo fix that skipped one would silently strip it.

**The order of those last arrows is the safety argument, not an implementation
detail.** Compose (nothing written live) → stage under `builds/<slug>/<version>/`
(additive; a refusal or a dead job leaves the live site exactly as it was) → the
gate → activate: **the pointer, conditionally** — on our own etag, so a newer
publish that landed while ours was working is never clobbered, and on the pointer
being ABSENT for a first activation, so two first publishes race in the store
rather than in an assumed lock — then the sidecar, the live marker, the script,
and only then the commit. **And an activation that cannot serve undoes itself**
(2026-09-06): a script upload that is not an explicit success rolls the pointer
back to the previous version under our own etag, puts the sidecar and the live
marker back, does not commit, and does not advance the editable source — because
the alternative is a site whose next edit builds on a version no visitor was ever
served. Which version is authoritative, stated once: **`current/<slug>.json`**,
and everything else is derived from it.

**Four doors that no customer can open**, and each is a different kind of
not-a-customer:

```
  the container reporting on its own generation — a token, never a person:
    POST /api/site/genresult    the answer, straight into R2
    POST /api/site/genbeat      its heartbeat, bound to the resume record
    GET  /api/site/genprobe     what that generation is doing

  the cron's platform republish — a job's replay marker is the ONLY credential:
    POST /api/site/<slug>/rebuild
    (it sits inside the owner block and refuses anything that is not a replay:
     a signed-in owner reaching it would be unbounded free container time)

  the job runner's gateway, mounted at the top of the app zone's router:
    ANY  /api/job/<id>/r2      R2, confined to this site's own prefixes
    ANY  /api/job/<id>/sb      Supabase, confined to this job's own rows
    POST /api/job/<id>/scope   a first build naming itself, re-minting its token

  the site's own visitors, through the platform rather than the step:
    /api/db/<slug>/{data,api,hook,auth,checkout,uploads,error,turnstile}
```

**What each door costs, and whether it queues.**

| door | what it is | model calls | queues | publishes |
|---|---|---|---|---|
| `POST /api/site/route` | which step this message is | 1 | no | — |
| `POST /api/site/react-build` | BUILD — design, generate, compile | 2 (+ web, + translate) | always | yes |
| `POST /api/site/<slug>/edit` | EDIT — the ladder, 21 lanes over 9 layers | 1–3 per rung | yes | yes, once |
| `POST /api/site/<slug>/addon` | ADDON — 9 kinds, then the page call | 1 picker + 1/kind + 1 page | yes | yes, once |
| `POST /api/site/<slug>/rebuild` | the platform republish | **none** | yes | yes |
| `POST /api/site/<slug>/text` | the owner's own typo fix | **none** | no | yes |
| `POST /api/site/<slug>/versions/restore` | put an old version back | **none** | no | activates |

The last three are the ones worth remembering: **a site can be republished,
reworded and rolled back with no model asked anything**, and all three still go
out through the one spine, so anything a build bakes they bake too.

### The owner's shelf — one matcher each, one gate for all of them

Every route below is `/api/site/<slug>/…`, every one is `assertOwner`-gated, and
a slug that is not yours answers the **404 a missing site answers** — the two
are deliberately indistinguishable from outside.

| | route | |
|---|---|---|
| the site | `edit` · `addon` · `rebuild` · `text` · `versions[/restore]` · `offline` | the steps, above |
| its data | `rows[/<table>[/<id>]]` · `rows/<table>/import` · `export` · `backups[/<day>]` | CSV in, JSON out |
| its people | `members[/<uuid>]` · `notify` | |
| its plumbing | `secrets[/<NAME>]` · `domains[/<host>]` · `jobs` · `errors` | |
| its face | `uploads[/<file>]` · `share` · `verify` · `analytics` | |

And four read-only diagnostics that take a `?slug=` instead of a path segment,
each gated the same way — a stranger gets the 404 a missing site gets:

| route | answers |
|---|---|
| `GET /api/site/answer` | the model's raw reply, kept whether or not it built (`&kind=addon` for the add step's) |
| `GET /api/site/migrations` | what an add-on's schema change actually made |
| `GET /api/site/reconcile` | a row under review, its facts and its verdict — DRY unless `apply=1` |
| `GET /api/site/runtime` | is this site queued? is it on the container runner? which deploy is live? |

`GET /api/site/reach` is the odd one and takes no slug at all: it is a
signed-in probe that asks a fixed container lane whether it can reach the
network, so it is about the platform rather than about a site.

`runtime` returns **booleans and a deploy sha only** — never a value, never the
canary list, and `readCanaryList` is not imported into `worker.js` at all, so no
later edit of that route is one line from handing back other customers' slugs.

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
  customer ──► pick_lanes ──┬──► edit_site ──┐       10 lanes, here
             the picked     │   one per lane │
             model's `quick`│   1 property   │
             21 names       │   0 required   │
             + a verb       │                │
                            ├──► picture / nav / rules / page / rename   9 lanes
                            │                │
                            ├──► page (remove | move) · addon (add)      1 verb lane
                            │                │
                            └──► escalate to `build`                     1 lane (kind)
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

### The twenty-one lanes — ALL of them act (owner, 2026-08-29)

> *"i need all the 17 lanes acting"* — seventeen then. Twenty-two once `three`,
> `behavior`, `tsx`, `gif` and `qr` arrived, and twenty-one since `gif` was
> retired on 2026-08-31. **Derive the groups, don't trust this table** — it has
> gone stale twice: `node -e` over `builder/site-lanes.mjs` and print
> `LANE_FIELDS`, `OWN_LANES`, `DISPATCHED_LANES`, `VERB_LANES`,
> `ESCALATE_LANES`, `UNBUILT_LANES`, `LANE_LAYER`.

Nine were refused at the door: named, priced at zero, sent up the ladder. Honest
about what this module edits, **wrong about the customer**, who asked for a
change and got a fall-through — and unnecessary, because six of the nine already
had cheap, shipping implementations one lane over. Nothing was missing but the
wire. So **`pick_lanes` moved above the layer dispatch** and is the front door
for all twenty-one; what it names decides which layer runs.

| | lanes | where the work happens |
|---|---|---|
| **10 act here** | `css` `theme` `brand` `description` `wordmark` `favicon` `lang` `langs` `behavior` `qr` | one tool, one property, 1 credit |
| **9 dispatch** | `images`→`picture` · `action`→`nav` · `backend`→`rules` · `slug`→`rename` · `purpose` `components` `shape` `three` `tsx`→`page` | that rung's own price, 0.3–3 |
| **1 verb lane** | `pages` — `remove`/`move`→`page`, `add`→`addon` | the router answers WHICH of the three |
| **1 escalates** | `kind`→`build` | a rebuild is what it is; the rung above does it |
| **0 unbuilt** | — | `slug` was the last, and it shipped as an alias |

**`OWN_LANES` is a group name, not a verdict** — renamed from `ACTING_LANES`
after the owner asked *"i thought all of them were act?"* twice. It means *the
ones this module edits itself*; the dispatched, verb and escalate lanes all do
real work too, just on another rung.

Nine of the ten are a plain string, enum or short list, which is why this module
owns its own shapes; `behavior` is the exception and shares `BEHAVIOR_ITEM` from
`site-plan.mjs`, the one module both paths may read. The nine **dispatch**
because a stored plan is read by nothing: the container gets the pages, the theme
and the stylesheet, never the plan. `shape` is not a value to save, it is a job
for the rung that rewrites pages. The five groups are a **total, disjoint
partition**, asserted in `test/edit-lanes.test.mjs` — a lane in no group is a
request that falls out of the door; a lane in two behaves differently depending
on which check runs first. And each group is a different sentence to a customer,
so collapsing any two loses a real distinction.

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

**`slug` was the last unbuilt lane, and it shipped as an ALIAS rather than a
move** (2026-08-29). A slug keys five Supabase tables, seven R2 prefixes and one
dispatch script, and R2 has no rename — so a "real" move is a loop of PUTs with
no transaction, and a copy that dies halfway leaves the site half at each address
with nothing to roll back to. **And the move needs everything the alias needs
anyway**: the old address has to keep working (customers print it, and we
generate QR codes pointing at it) and the old name has to stay CLAIMED, or the
next build of `shoeroom-1` takes over an address a live site still redirects
from. So the alias record IS the feature and the copy is pure added risk. The
lane dispatches to `rename`, and `UNBUILT_LANES` is empty — the group is kept
because it is a real state a future lane can be in, and the guard asserts it is
empty and names anything that lands back in it.

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
