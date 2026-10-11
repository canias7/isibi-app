# 2026-10-11 — Waiting only on what a task consumes: Add-on designers, look lanes, and the operation inventory

The owner's goal, restated for this batch: *"Any independent supported tasks
should perform their substantive work concurrently, within the existing
concurrency limit. A task waits only when it actually needs another task's
result, or when applying the changes would conflict."*

Codex passed 198 focused tests on `adbb7ad7` and reproduced the next gap:
one Add-on asking for an empty signups table (a `name` text column, nothing
showing it) and a static FAQ on the existing About page. In both wording
orders, both changes completed and each designer ran once — but a
rendezvous between `add:table` and `add:component` failed. The table
designer had to finish before the component designer started.

**Commits**: `8b142e85` (the change and its tests), `a8924c3d` (acceptance
pin), with records after.
**Image prediction**: production `8d6dbcea93252fbb` → `9d5c417c92c65f99`
(205 inputs, on `8b142e85`; was `47981cf0b832bfad`). Not built.
**Base**: `adbb7ad7`. No merge, deploy, container build, paid call, real
image, fal call, balance change or flag change. Every provider is mocked.

## 1. CI run 38148556722 (job 114496960044): the failed npm test step

- **What failed**: `BG11` in `test/reply-background.test.mjs` on
  `adbb7ad7` — *"a held reply never reached its writer"*.
- **Cause**: the case waited for the held replies to reach the writer by
  counting event-loop turns (`setImmediate`, at most 200), then asserted the
  count. Each held reply reaches the writer only after a few storage reads
  and writes, and on the slower CI runner 200 turns ran out before the last
  one arrived. The product was right; the wait measured the wrong thing.
- **Fix**: the case now waits on the arrivals themselves. The stand-in
  writer counts each call as it arrives, and the case waits until the count
  reaches the number of held replies (30 s cap, only as a hang guard). The
  assertion is unchanged: every held reply must reach its writer, and
  exactly that many. No timeout was raised and nothing was loosened.
- **Checked**: BG11 3 of 3 locally; the file 11 of 11.

## 2. The Add-on gap, and its cause

`aChangesSite`/`aStartFrom` (`worker.js`) started each designer early only
while no earlier kind that **could** change the site facts was still
undecided. Every schema kind (table, function, API, job) and `page` was such
a kind, so anything after a table waited for it, whatever it asked for.
That was by **category**, not by input.

The block was real at the input level: every designer was shown the whole
site as decided so far (`aSite`), so a table decided first changed the FAQ
designer's request ("signups — being added by this same change"), and an
early FAQ answer could never be an exact replay. So the fix had to narrow
**what each designer is shown**, not only when it starts. Narrowing the
start alone is what let a stale answer through on 2026-10-11 (the re-base,
`2026-10-11-independent-tasks.md`).

## 3. The change: each designer is shown, and waits for, only what it uses

**`designWaits(kinds, { scopes, uses })`** (`builder/site-add.mjs`) names,
for each kind, the earlier kinds it is built on:
- the kinds the picker says it **uses** — a new `uses` list on each picker
  scope (required, so an entry that says nothing is unread). Examples given
  to the picker: a form or page that saves into or shows a new table uses
  `table`; a section, code or link on a new page uses `page`; a job running a
  new function uses `function`;
- the kinds that share its **words** (one phrase asking for two kinds, "a
  booking page", is one thing to build);
- for a **schema kind**, every schema kind before it — a function,
  connection or job is written against the schema it is shown. This keeps
  the table → function → job chain by what each consumes;
- and, transitively, what those wait for.

A kind the picker said nothing about (no `uses` list) waits for every
earlier site-changing kind, exactly as before. Only earlier kinds can be
waited for (designers run in `ADD_KINDS` order), and only kinds that change
what a designer is shown.

**In the route** (`worker.js`):
- `aSiteFor(k)` builds the site a designer is shown: the stored site with
  only its own dependencies' results folded in, through the same fold the
  loop uses (`aFoldInto`, extracted from the two inline folds, applied in
  the decided order `aFolded`). A designer that waits for every earlier
  result gets the very same `aSite` object.
- `aStartReady` starts every designer whose dependencies are all decided —
  at once, beside the others. The existing exact-request check stays: an
  early answer is used only when its request is still byte for byte what it
  would be asked now (a hand-off brief that arrived since, for example,
  makes it ask again).
- `aShown` records, per kind, the site really shown for the answer used.
- `cleanAdd` and the fold still see the whole decided site.

**A designer shown less of the site can say it needs more** — the same
contract as a prepared edit step's `needs` (`2026-10-11-exact-reuse.md`):
- its note names, by kind and in the customer's own words, what this same
  change is designing that the note does not show (`unshown`, from
  `designWaits` alone, so the request is the same bytes whenever built);
- every designer tool (all but `row`, never designed beside others) has a
  `needs` list: name the kind and design nothing;
- `aNeedsAgain` then asks it again, once, with every earlier result shown
  (all earlier kinds are decided by its turn). Both calls are real model
  work and both are on the bill; the first answer is never used.

## 4. The look door's lanes

The lanes picked for one look change (description, business name, theme,
stylesheet, language, and so on) were each awaited in turn. No lane reads
another's answer: each is shown its own words, its own field's stored value
and, for the stylesheet lane, the site's styling. They now start together
(`eLaneCalls`), each with its own clarification answers fixed (`eQuick`'s
new `ctx` argument — the transport used to read whichever `eCtx` the loop
had moved on to). The loop takes them in the picked order with every exit as
before: a failure or a question from any lane sets the whole step aside, the
other answers unused and uncharged. A removal is still not a call; a
list take-off is still its own small call, made in turn.

## 5. Operation inventory: what overlaps, what still waits

How to read it: **overlaps** means the model work of independent tasks runs
at the same time, proven by a rendezvous in an offline test. Writes are
always applied one job at a time, in dependency order, and a reused
preparation is accepted only by exact replay.

### Between parts of one request (`builder/request-plan.mjs`)

| Operation (as a part) | Planned as reading | Overlaps with | Evidence (rendezvous or interval tests) |
|---|---|---|---|
| text, every write on named pages | those pages (`prepScope`) | parts not writing those pages | IND 1, PC 1, PI 29 |
| data, every write on named tables | those tables | parts not writing those tables | IND 2, PC 1, PATH data |
| addition onto existing named pages (component, photo, words) | the page list, the theme, its pages (`addonScope`) | parts not writing those pages | PI 2, PI 3, PI 29 |
| photograph (picture step) | the pictures | text, menu, data | P1, PATH data/rules |
| menu (nav) | the menu and the page list | data, look lanes; a link to a page another part makes waits for it | PC 2, PC 3, P2 |
| look | the theme and every page | data | PATH look, PC 2 |
| rules | every table | photographs, text | PATH rules |
| page step (rewrite or tweak) | every page and the page list | data | PATH page, PATH page tweak |
| addition making a table, function, API, job, new page or menu link | page list, theme, menu, pages, pictures | data and rules only | PATH add-on page, PATH add-on row (see "still sequential") |
| logo | the whole site | nothing | — |

### Inside one Add-on (`worker.js`, one job)

| Work | Now | Evidence |
|---|---|---|
| designers with no dependency between them (table + FAQ, photo + component) | together, each shown only what it uses | PI 1, PI 24 (both orders), PI 30 |
| a designer that uses another's result (a form saving into the new table) | waits, is shown it, asked once | PI 25 |
| the table → function → job chain | kept, by what each is written against | PI 27 |
| picker said nothing about uses | old order | PI 26 |
| picker wrong (said "uses nothing", it needed the table) | designer answers `needs`, asked again once | PI 28 |
| the photograph's purchase beside the page writer | together (round 1) | PI 1 |
| page writer | one call for every frontend kind | — |
| apply: provision → schema → look merge → publish | in order (writes) | existing |

### Inside one Edit (`worker.js`, one job)

| Work | Now | Evidence |
|---|---|---|
| look-door lanes (description, name, theme, stylesheet, language, …) | together | PL 1, PL 2 |
| list take-off lanes | in turn, one small call each | existing |
| dispatched rungs in one edit job (text, picture, page, menu, …) | in turn — each reads and writes stored state | existing (owner: one publish per act) |
| text step, data step | one call each, scoped when prepared | IND 1–8 |

### Build (`worker.js` build path)

| Work | Now | Evidence |
|---|---|---|
| design agents | concurrently by their needs | P8 (`parallel-requests`) |
| photographs beside page generation | together | BLD 1, BLD 7 |
| compile inputs beside photographs | together | BLD 9 |
| the 1-page / 15-component limits, Build flags | unchanged | `build-batch-*`, acceptance |

### Mixed batches

- Seven tasks in one message, more than the preparation limit (3): freed
  slots refilled, independent work beside the first job — `BATCH`,
  `BATCH 2` (`parallel-batch`), unchanged.

## 6. Verification

- **Red check** (the new tests over `adbb7ad7`'s `worker.js` and
  `builder/site-add.mjs`): PI 24 (both orders), PI 27, PI 28, PI 30 and
  PL 1 fail; the controls PI 25, PI 26, PI 29 (both orders) and PL 2 pass.
- **Mutation sweep** (`sweep10`, 4 files, green baseline 160): 16 product
  mutants and a comment-only control. The control survived; 15 were killed
  by the swept files. The survivor (a look lane shown whichever answers the
  loop last set, not its own) is killed by the existing
  `live-clarify-continuity` case "EACH LOOK LANE IS SHOWN ONLY THE ANSWERS
  ITS OWN CHANGE NEEDS", which the sweep did not run (checked by hand).
- **Focused**: the parallel, add-on, request and requirement files, 1,466
  cases green before the lanes change; 160 across the four swept files after.
- **Doc tests** 32 of 32; acceptance entry points green with the new pin.
- **Full suite and CI**: recorded below once the runs end.

## 7. Fixed, still sequential, live-unverified

**Fixed in this batch (offline proof)**
- Add-on designers wait by input, not by category: Codex's table + FAQ
  overlaps in both orders (PI 24), real dependencies still wait (PI 25), a
  wrong "uses nothing" is caught by `needs` (PI 28), the schema chain is
  kept (PI 27), and a question pauses the addition with nothing applied,
  then resumes it with the table made once (PI 30).
- Look-door lanes run together (PL 1), and a question from one lane still
  sets the whole step aside (PL 2).
- BG11's CI failure (§1).

**Still sequential, by reason**
- **A table, function, API or job addition as its own part** waits for any
  earlier part writing pages, the menu, pictures or the theme. Every table
  addition runs the page writer, which must return a page and may choose
  any, so its reach is the model's choice inside the step. Narrowing it
  would need the page writer scoped like a component addition's.
- **Look, rules and page steps as parts** are planned as reading every page
  or every table (unscoped).
- **Dispatched rungs inside one edit job** run in turn; each reads and
  writes stored state, and the router splitting a message into parts is
  what lets their model work overlap.
- **Within one Add-on**, the page writer is one call, and a question from
  any designer pauses the whole addition (its apply is one publish). Other
  parts of the request carry on.
- **Writes** are applied one job at a time, by design.

**Live-unverified**
- None of this is deployed or pressed. Whether a real picker fills `uses`
  accurately, and whether a real designer says `needs` when it should, is
  not shown; the mocks here answer as the instructions ask.
- The look lanes' concurrency on the real Worker, and the model provider's
  own concurrency limits, are not measured.
