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
        │     ↓     │    │            │    │ it's a flag │
        │ edit_site │    │ design_    │    │ (remove:    │
        │ 1 field   │    │  schema    │    │  true) on   │
        │ 4.0k      │    │  84.8k     │    │ page + logo │
        └───────────┘    └────────────┘    └─────────────┘
```

**Status of the split (2026-08-29).** `EDIT` is done. `ADDON` is next and has the
identical defect the edit step had. `DELETE` is deferred — owner's call: *"we are
gonna worry about delete later"*.

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
  customer  ──►  pick_lanes  ──►  edit_site  ──►  publish
                 haiku            one per lane     ONCE
                 2,811 chars      1,201 (css)      however many ran
                 17 names         1 property
                                  0 required
```

Two asks run two lanes **in turn** (owner: *"run both lanes in turn"*), each shown
only its own field's stored value, so they cannot collide — and one publish
covers the message, not one per lane.

### The seventeen lanes: 8 act, 9 hand off

| acts here | | hands off | |
|---|---|---|---|
| `css` | the stylesheet — any colour, size, spacing, corner, typeface, one control | `kind` | → page rung |
| `theme` | the whole visual world, by name | `purpose` | → page rung |
| `brand` | the site's name | `pages` | → page rung |
| `description` | the line under the name in a search result | `components` | → page rung |
| `wordmark` | the header logo | `shape` | → page rung |
| `favicon` | the tab icon | `images` | → page rung |
| `lang` | the declared language | `action` | → page rung |
| `langs` | every other language offered | `backend` | → rules rung |
| | | `slug` | → a move, not an edit |

**Every field the design tool can produce has a lane**, so no part of a site
becomes unreachable — asserted in BOTH directions by `test/edit-lanes.test.mjs`,
because a field added to the build with no lane is a part of a site the customer
can never change again, and a lane for a field the build stopped producing edits
nothing. Neither announces itself.

**But only eight are values this rung can honestly change.** The nine on the
right are `PLAN_KEYS` plus `backend` and `slug`: inputs to page GENERATION that
nothing downstream of a cheap edit reads — the container is handed the pages, the
theme and the stylesheet, never the plan. Storing a new one changes nothing a
visitor can see while reporting success. `worker.js` always refused them
(`needsPages`); what is new is that they are refused **by name, at the door,
before a model call is bought**, and the refusal says which rung can do the work.

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
