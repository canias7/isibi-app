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
  customer ──► pick_adds ──┬──► add_to_site ──► the page call ──► ONE PUBLISH
               picked model│    one per kind      (addon mode:
               1.9k chars  │    one property      returns only what
               6 kinds     │    0 required        is new or changed)
                           └──► picture                 ← photo, one hop sideways
```

**Six kinds, the intent router's own list**: `table` · `page` · `section` ·
`qr` · `three` act here, `photo` dispatches to the picture rung (the one that
places a photograph and prices it; this step never buys one). Order is run
order — a table before the page that shows it. Each acting kind has a
four-part rule (`is` · `yours` · `wide` · `keep`), a shape of its own, and a
tool with ONE property and nothing required, so a kind that cannot answer
returns nothing and the route says so.

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

**Refusals are sentences, never climbs**: a code or a scene the site already
carries (read the way the edit route's wall reads it — the stored look OR the
page source), a table on a site with no database, a page the site already
has, a code with no real destination. Every one is a named 422 with the door
that does change it; only a picker that names nothing escalates to the revise.

**Every prompt is a placeholder** (owner: *"i will tell you the prompt
later"*), marked so in the module, one `hint` and four rule parts per kind.

**Proven in the tree, NOT yet live** — `scripts/addon-sweep.mjs` behind
`harness: addon` in `lane-sweep.yml` is what proves it on the site.

## The DELETE step — does not exist as a step

`remove: true` rides on the edit router (`REMOVABLE_LAYERS`) and reaches exactly
two things: a whole page, and the logo. A section, a component, a table, a
language or a photograph cannot be deleted — those fall through to the ~25-credit
full rewrite, which is also the rung least likely to actually delete anything
(measured three times: asked to delete a page, the page model rewrites the site
and never sets the field that deletes one — which is why the ROUTER decides it).

Deferred by the owner, 2026-08-29.
