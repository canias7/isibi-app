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
        │ ✅ SPLIT   │    │ ❌ STILL   │    │ ❌ NOT A    │
        │  2026-08-29│    │  CALLS THE │    │  STEP AT    │
        │           │    │  BUILD'S   │    │  ALL        │
        │ pick_lanes│    │  DESIGNER  │    │             │
        │  = THE    │    │            │    │ it's a flag │
        │  FRONT    │    │ design_    │    │ (remove:    │
        │  DOOR for │    │  schema    │    │  true) on   │
        │  all 17   │    │  84.8k     │    │ page + logo │
        │     ↓     │    │            │    │             │
        │ 8 act here│    │            │    │             │
        │ 6 dispatch│    │            │    │             │
        │ 3 unbuilt │    │            │    │             │
        └───────────┘    └────────────┘    └─────────────┘
```

**Status of the split (2026-08-29).** `EDIT` is done, and all seventeen of its
lanes now act — eight in the edit path itself, six by dispatching to the layer
that really does that work, three escalating under their own name because they
are genuinely not built. `ADDON` is next and has the identical defect the edit
step had. `DELETE` is deferred — owner's call: *"we are gonna worry about delete
later"*.

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

## The ADDON step — not yet split

`worker.js` calls `designSiteSchema(env, aInstruction, aModels.design, {...})` to
add one page or one table. Same 84.8k build tool, same build wording, same
complaint. **Next.**

## The DELETE step — does not exist as a step

`remove: true` rides on the edit router (`REMOVABLE_LAYERS`) and reaches exactly
two things: a whole page, and the logo. A section, a component, a table, a
language or a photograph cannot be deleted — those fall through to the ~25-credit
full rewrite, which is also the rung least likely to actually delete anything
(measured three times: asked to delete a page, the page model rewrites the site
and never sets the field that deletes one — which is why the ROUTER decides it).

Deferred by the owner, 2026-08-29.
