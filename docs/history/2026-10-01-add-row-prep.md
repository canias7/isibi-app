# 2026-10-01 — Test 11 prepared: one item added to an existing list (not runnable yet)

Free analysis only: no model was called, nothing was spent, and no routing
policy was changed. The owner, after closing Test 10:

> Next, prepare the remaining "add one item to an existing list" test using
> free analysis only. Respect my existing rule: "Add will always go in
> addon." Trace whether that route can add exactly one row to an existing
> table. Identify the exact request, existing demo, current baseline,
> expected result, unrelated content to preserve, testing support, and
> estimated cost.
>
> If there is a concrete capability or testing gap, explain it and propose
> the smallest next step. Don't change routing policy or start a paid run
> during preparation.

The test, its baseline and its expectations are the checklist's *Test 11*.
This file is the story of the trace.

## 1. The route

- **The router** sends an addition to the add-on step. Its `intent` field
  defines "addon" as "ADDING SOMETHING THE SITE DOES NOT HAVE YET", asks
  "does the thing they name exist on the site now?", and ends "WHEN YOU
  CANNOT TELL, ANSWER addon". Its `data` clause covers deleting a row only,
  and says the added-row question was the owner's to decide. The owner has
  now answered it (2a): the add-on step.
- **The add-on step** (`builder/site-add.mjs`) runs `pick_adds`, then one
  designer per kind: `table · function · api · job · page · component · qr ·
  three · photo`. None of them adds a row to a table the site already has:
  - `table` creates a table, or gives an existing one a new column, payment
    or a public view (`mergeAddonSchema`, `ADDON_TABLE_FIELDS`);
  - its `seed` is described as "starter rows for the new table", and is
    written by `seedSiteRows` (`site-schema.mjs`). That seeds display tables
    only, and skips any table that already has rows: its idempotence guard,
    which protects a revise from re-seeding a list that has content;
  - `component` and `page` write page code.
- **The one row insert in the product** is the edit side's data step
  (`DATA_TOOL` in `builder/site-apply.mjs`: "LEAVE [id] OUT to add a new
  row"; `runDataEdit`'s `INSERT` in `worker.js`). Under the owner's rule an
  addition does not reach it, and changing that is routing policy, so it is
  not proposed.

## 2. The rehearsal (scratch, not committed)

Through the real `POST /api/site/<slug>/addon`, using the route's own test
fixture (`test/fixtures/addon-route.mjs`), on a stand-in of the bakery:
`loaves` a public list that already has rows, the stored pages, and every
model answer supplied. Seven cases:

- **no kind picked**: `no-add`, cost 0. "I couldn't determine a supported
  addition from that message. Please clarify what you'd like to add.";
- **`table` re-declaring `loaves` with no columns**: refused (`no-columns`),
  cost 0;
- **`table` re-declaring `loaves` with its columns and one seed row**:
  - the page writer returns `/order` unchanged: `no-change`, cost 0;
  - the writer adds a hand-written card: **published as a success**, the
    stored schema re-applied as it stood, `seedSkipped: ["loaves: already
    has rows"]`, no row inserted. The customer reads *"✅ Done — updated
    /order. I had starter rows ready for loaves and didn't put them in —
    that table isn't one visitors can read, so it starts empty."*;
  - the fixture's default stand-in page instead of the stored one: refused
    `rewrote`, an artefact of the stand-in;
- **`component`**: a malformed answer is refused (`no-component`); a kit
  part on `/order` is **published as a success** ("✅ Done — updated
  /order."), with no row inserted.

**Conclusion**: the add-on route cannot add exactly one row to an existing
table. A real answer ends in a refusal, at no cost for the step, or in a
false success: a hand-written card on `/order`, while the list, the order
form's choices, the price order and the Data panel do not change.

## 3. Found on the way (backlog)

- **`seedSkipNote` drops the reason** after the colon. Every skip reads as
  "isn't one visitors can read, so it starts empty", including "already has
  rows".
- **The fixture's existence probe answers no rows**, so an existing table
  reads as empty. Run unchanged, the same `table` answer inserts the seed
  (`seeded: {loaves: 1}`): a false pass for any row-adding test built on it.
  The rehearsal answered the probe with a row, as the live bakery would.
- **The canary cannot press an add-on.** Its one-request path refuses unless
  the router answers `edit` with a layer.

## 4. The baseline (free, read-only, 02:45 UTC)

Identical to Test 10's after-read at 01:57:
- `loaves` whole, `0-5/6`, 1,045 bytes, `ef870ebc…`, and the rows box
  reads `as named`;
- the five pages at `01790819484141-dgmag4`;
- `/order` sorted by price;
- the six redirect probes as before;
- screenshots of the five pages.

## 5. The smallest next step (proposed, not built)

1. **One add-on kind, `row`**, for a new entry in a list the site already
   stores:
   - cleaned against the stored schema: display tables only, existing
     columns only;
   - written by the data step's own `INSERT`, shared rather than copied;
   - no page call and no publish;
   - billed once, with the reply composed from the inserted rows.
2. **The canary posts an `addon` answer to the add-on route** when the route
   box says `intent=addon`, instead of refusing it.
3. Then the live test (about 3–4 credits) after a merge, a deploy, a free
   runtime check and a top-up: the balance is 3.
