# A new entry in an existing list is routed to the add-on step (2026-10-01)

Written on the branch after run 86, for the owner's review; merged and
deployed in deploy 2177 the same evening, on the owner's word (§8). Test 11's
retry is prepared, not pressed.

## 1. What happened

Run 86 (edit canary 36908358798, 18:38 UTC, Test 11's paid press) sent *"Add
one loaf to today's loaves: Rye & Caraway at £5.00, described as "A light rye
with toasted caraway.""* to `fold-lane-bakery`. Its database already holds
that list (`loaves`, six rows).

- The real router (grok-4.6) answered `intent=edit layer=data`, cost 2.
- The press expected `intent=addon alsoAsked=none`, so the canary's route
  check refused to post the edit. Nothing was added or published, and only
  the routing call was paid.

The record is the checklist's *Test 11* (*Run 86*).

## 2. The owner's instruction

*"Fix the router for Test 11. Adding a NEW record to an existing table/list
must select addon. The parent list already existing does not make the new
item an edit. Align the model-visible instructions in builder/site-ask.mjs:
the addon description, edit/addon tie-break, data-layer description, and any
conflicting cost preference. Remove the obsolete "owner's open decision"
comment. Make this general across products, services, team members, etc. No
bakery-specific rule or keyword override. Updating or deleting an existing row
remains edit/data; preserve sorting scope and mixed-request handling. Use
focused free regression checks. Verify the actual request sent to the model;
supplied model answers prove downstream handling, not real classification.
Keep the canary's expected-addon guard. Run the required CI on the finished
candidate, update docs/owner-notes.md and the checklist, then commit/push for
review. Leave CLAUDE.md alone. Don't merge, deploy, or retry the paid test
yet."*

## 3. Why the router answered `data`

The router's tool never said where a new row goes, and three model-visible
sentences pointed at `data`:

- **the edit/addon tie-break**: *"does the thing they name exist on the site
  now? It does — "edit"."* The loaves list exists;
- **the data clause**: *"prefer it whenever the thing being changed is one row
  of something the site lists"*;
- **the system's cost rule**: *"Pick the cheapest one that can honestly do the
  job"*, where an edit is the cheaper answer.

The `addon` clause named a page, a new table, and a section or similar on a
page, but not an entry in a list the site already keeps. A comment at the
data clause still read *"whether an added row is this layer or the add-on step
is the owner's open decision, and nothing here says"*, although the owner had
answered (2a, 2026-10-01: *"Add will always go in addon"*) and the add-on
`row` kind was built and deployed (deploy 2175).

## 4. The change: four sentences in `builder/site-ask.mjs`, nothing else

- **The `addon` clause** (in `intent`) gains: *"A NEW ENTRY IN A LIST THE SITE
  ALREADY KEEPS IS AN ADDITION TOO: a new product, service, dish, class, event
  or team member is a new row in a table the site already has. The list
  existing does not make it an edit, for the same reason: "add a new service
  to our list" and "put our new apprentice on the team page" are both
  "addon", because that entry does not exist yet."* One example has no "add"
  in it, so the word cannot read as the rule.
- **The tie-break** keeps its question and says what it is asked of: *"ASK IT
  OF THE THING ITSELF, NEVER OF WHAT IT GOES INTO: a new entry in a list the
  site already keeps does not exist yet, so it is "addon" however long the
  list has been there, just as a new section on an existing page is. Changing
  an entry that is already there, or taking one off, is "edit"."*
- **The data clause's** preference now reads *"prefer it whenever the thing
  being changed is a row the site already stores. A NEW ENTRY IS NOT THIS
  LAYER: adding one to any of those lists is intent "addon", not an edit,
  however cheap this layer is and however long the list has been there."*
- **The system's cost rule** gains: *"COST NEVER MAKES A NEW ENTRY AN EDIT: a
  new product, service or team member in one of their lists is an "addon"
  even though the list already exists, because for a list an edit only changes
  or takes away the entries that are already there."*
- **The obsolete comment** is replaced: a new row is not the data layer, and
  the history now sits at the `addon` clause.

**Unchanged:**
- the route and every other module, so there is no keyword rule: the route
  passes the model's answer on as given;
- the data clause's removal sentence and `look`'s two exceptions (a whole
  page, a stored row), so deleting an existing row stays `edit` + `data`, and
  changing one stays there too;
- both sort sentences (data: the whole site only; page: one named page);
- `alsoAsked`, the hold rule;
- the layer field's closing whole-message rule;
- the canary's expected-route check (`scripts/canary-route.mjs`).

**Not changed, recorded:** the data step can still insert a row when a
message reaches it (its tool's "LEAVE [id] OUT to add a new row", recorded in
the checklist's *Test 11* preparation). This change routes; it does not take
that path away.

## 5. Tests

**New file: `test/router-row-add.test.mjs`, 12 cases.**
- **Six read what the router is told**:
  - the `addon` clause's new line sits inside the addon description, names
    several kinds of list, and has an example without "add";
  - the tie-break;
  - the data clause: the new preference, the new-entry sentence, and the
    removal and sort sentences kept;
  - the cost rule, in its own paragraph;
  - no fixture word in any of the four;
  - the old comment gone.
- **Two read the request the real `POST /api/site/route` sends**:
  - to xAI with no picker, which is the canary's call and run 86's router.
    The tool's descriptions, the system message, the forced tool choice, the
    tables and the customer's sentence are all read as they left;
  - to Anthropic with the `sonnet` picker.
- **Four supply the router's answer and read what the route does with it**,
  which is downstream handling, not classification:
  - an `addon` answer for a new entry goes on with nothing held back, and
    Test 11's route box would post it;
  - **run 86's `edit` + `data` answer comes out exactly as given, with or
    without "add" in the message** (no keyword override), and the box
    refuses it on `intent` alone;
  - an update, a deletion and a site-wide sort still go on as data edits;
  - a mixed message's `addon` answer keeps its hold word for word, and the
    hold and whole-message wording are unchanged.

**Revised: one case in `test/router-row-removal.test.mjs`.** It read *"the open
decisions stay open"* and required the data clause to say nothing about
adding, which encoded the owner's 2026-09-30 *"Do not decide or change add-row
routing"*. It now requires the removal sentences to say nothing about adding
or ordering, and the data clause to speak of adding on exactly one line, the
new-entry sentence.

## 6. Verification, measured

- **The router's 48 test files** (every test file that imports the router,
  names its tool or calls the routing route), run on the change before the
  guard was revised: **1,759 cases, 1,758 passing**. The one failure was the
  guard above, as expected; nothing else moved.
- **Red check** (a throwaway worktree at `f004671d`, the old wording, with the
  new and revised tests copied in): **9 of 21 fail**: the 8 wording and
  request cases and the revised guard. The 12 that pass on both are the 4
  supplied-answer cases and the 8 unchanged removal cases, which shows those 4
  prove handling, not the fix.
- **Mutation sweep** (`scripts/mutants/router-row-add.json`, against
  `router-row-add`, `router-row-removal`, `router-list-sort`,
  `add-goes-to-addon`, `canary-route`, `site-ask` and `model-xai`, from a
  green baseline of 178 cases):
  - **19 of 19 killed, 0 survived, 0 never applied**, and the 2 comment-only
    controls survived;
  - every anchor was checked to occur exactly once, and every mutated file
    to parse, before the run;
  - the three swept files' checksums matched afterwards.
  - The mutants: each of the four sentences dropped, inverted, narrowed or
    put back as it was; the old comment restored; a keyword override added
    to the route (`add|put` rewrites the answer to `addon`); the system prompt
    cut before the new sentence; the xAI request dropping the tool's schema;
    and the canary's check ignoring `intent`.
- **The router's test files after the revision** (49 now, the new file among
  them): **1,771 of 1,771**.
- **The full unit suite**, locally on the finished change: **8,543 / 8,543 /
  0 / 0** in 138 s (8,531 before, plus the 12 new cases; the revised case
  replaces one). `playwright-core` was present, so the two browser cases ran.

## 7. Required CI on the candidate, `710ad704`

- **Unit tests**, run 36914783961: `success`, **`8543 / 8539 / 0 / 4`**. The
  total matches the local run; CI skips the same 4 as always.
- **Site build**, run 36914784000: `success` (19:30:27–19:43:48 UTC). Two
  shards spent about six minutes installing the browser, so the run was longer
  than the 7m20s of its validation run.
  - The gate: *"ALL CHECKS: 404 checks in 27 sections across 4 shards, every
    job green"*, at inputs `899b2151f6729573` (3,967 files), the fingerprint
    computed locally before the push.
  - The other counts, from each step's log: TAP 397, kit-typecheck 4,
    contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
    site-runtime 47; kit-render, kit-a11y, kit-effects and kit-paint all
    passed.
- **The image**: `builder/site-ask.mjs` is one of its inputs, so a deploy
  would roll it, `c051f625db27b5b7` → **`9a71a6384b4206a2`** (189 inputs,
  predicted from git objects at both ends). After such a deploy the container
  work waits 15–20 minutes before the runtime check.

## 8. Merged and deployed (deploy 2177, 2026-10-01)

- **The owner's word**: *"Complete the approved merge and deployment of the
  reviewed router fix through 25faac78, reusing the existing passing CI
  evidence."*
- **The merge**: `main` fast-forwarded `78a95a47` → `25faac78` at 22:50:07
  UTC. No CI was repeated:
  - unit tests on `25faac78` itself, run 36916597462, `8543 / 8539 / 0 / 4`;
  - the site build above (§7), whose inputs fingerprint `25faac78` shares.
- **The deploy**: run 36937413961, `success`. The image was built and
  rolled `c051f625db27b5b7` → `9a71a6384b4206a2` at 23:05:58 UTC, as
  predicted, and the Worker's `DEPLOY_ID` is `25faac78…`
  (`docs/deploy-record.md`).
- **Not yet shown**: the runtime check (the owner's free press, not before
  23:26 UTC), and how a real model classifies an added entry, which only
  Test 11's paid retry can show (the checklist's *Test 11*, *Deploy 2177*).

## 9. The real router, after the fix: run 88 (Test 11's paid retry)

- **Run 87** (23:25 UTC, free): the runtime check passed on `25faac78` and
  `9a71a6384b4206a2`, the table *"as named"*, nothing charged.
- **Run 88** (23:51 UTC, the owner's paid press): the same sentence run 86
  sent, *Add one loaf to today's loaves: Rye & Caraway at £5.00, described
  as "A light rye with toasted caraway."*:
  - **the real router answered `intent=addon`, nothing held back**
    (grok-4.6's answer as the route returned it; cost 3, 8.3 s). Run 86, on
    the old wording, answered `edit`/`data`;
  - the add-on step's `row` kind saved exactly one entry, `loaves` id 7, and
    the reply said so; the six existing rows and every page were unchanged;
  - 5 credits in all (routing 3, the add-on 2), against an estimate of 3–4.
- **What this shows**: for this sentence, the corrected wording changed the
  real router's answer from `edit` to `addon`. It is one sample: how often,
  and for other lists, phrasings or mixed messages, is not measured. The
  owner's next order is a router audit with its own focused real-model
  routing tests (the checklist's *Test 11*, *Run 88*; the owner-notes
  handoff).
