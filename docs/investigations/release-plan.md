# The release of the reporting batches: one stage to authorize (2026-10-06)

The owner, after Codex passed the correction `9c2ca743` at branch head
`1f3dc370`: *"Close this reporting fix and prepare the concrete release plan:
exact commits, the single required container image build, deployment and
served-file checks, then one combined Edit/Add-on live verification with the
exact request, expected results and estimated credit cost against the last
recorded balance of 21. Include checking the resulting pages and submitting any
form created by that test. Clearly separate controlled failure-test evidence
from what the live check would prove. Keep unrelated gaps and model-written
progress updates parked. Preparation only: no merge, deployment, container
image build or paid retest until I approve the prepared plan."*

**Executed on 2026-10-06, on the owner's approval, and the live check
passed**: `main` `d75d79f3` → `b2409b3c`, deploy 2185 with the image built
once as predicted (`c7fe818d446dd957`), the served files byte-identical, the
image window, the runtime confirmed by the owner's free press (run 102), the
balance raised to 35 at the owner's request, and **the owner's paid press,
run 103: every check passed, 26 credits** (balance 35 → 9). The readings are
in `docs/history/2026-10-06-deploy-2185.md` §7.

*As prepared:* the press below is a new canary scenario, `lv-release`,
prepared on the branch for review with this plan (§4.3). **The balance did
not cover it** (§5): the press refuses at no cost until it does.

## 1. What is released

**The candidate** is the branch's tip at the merge. `main` is `d75d79f3`
(deploy 2184, image `589e3e4e85a20066`, live and runtime-confirmed by run
100), an ancestor of the branch, so the merge is one fast-forward. At this
writing the branch is `main` plus 22 commits to `1f3dc370`, then this plan's
own: `f448aaba` (the scenario), `8eceb2bd` and `fb42ff16` (its records), then
the form step's correction after Codex's review (§4.4), `09470116`, and its
records (`d6de4ea9` and the CI record after it). Their product content, in
order, each reviewed:

| Commit | What | Review |
|---|---|---|
| `839ef271`, `df22f457`, `d53caefc` | records of deploy 2184, run 100 and run 101 | docs only |
| `936295a5` (records `4315ab4d`) | run 101's corrections: the preview frame survives renders, reverted and changed outcomes reconciled, add-on requirements grounded in the request, the canary's closed-tab baseline | the owner |
| `0f94d159` (records `3ee6ab9d`) | each add-on requirement judged by a model for meaning and necessity; code checks what really ran | the owner |
| `4b6271ff` (records `4865cb97`, `497c47b0`) | a judgment that does not finish stops the add-on (one bounded re-ask) | Codex |
| `95f5a9d0` (records `52307af6`, `f060a8b8`) | every requirement told to the reply model, one fact each | Codex |
| `46a7746c` (records `77da1770`, `08b9a657`) | a refusal's requirements told; every missing page, code, seed skip and empty table named | Codex; the owner passed the warning lists |
| `c4748136`, `9c2ca743` (records `13bfcd17`, `9d309401`, `49a67763`, `1f3dc370`) | a failed addition says what it left behind; a database made beside an interrupted apply said as made, not empty | Codex, both (`9c2ca743` at `1f3dc370`) |
| `f448aaba`, then `8eceb2bd` and `fb42ff16` (docs only) | the release check scenario (canary only) and these records | for review with this plan |
| `09470116`, then `d6de4ea9` and the CI record (docs only) | the release check judges each form entry under the column its field is bound to, and reports a binding it cannot establish as a limitation (§4.4; canary only) | for review with this plan |

**What reaches production**: `worker.js` and `builder/site-add.mjs`,
`site-addon.mjs`, `site-migrations.mjs`, `site-reply.mjs` and
`site-requirements.mjs` (the Worker and the container), and one served file,
`public/chat.js`. The canary scripts, the tests, the docs and the canary
workflow's form-box description deploy nothing. No deploy configuration or
other workflow changes.

**The one container image build**: `589e3e4e85a20066` (live) →
**`c7fe818d446dd957`**, predicted on both ends (`containerInputs`, `imageId`);
194 inputs, none under `public/`. It is predicted again at the final candidate
before the merge; this plan's commits touch none of its inputs.

## 2. The stage, in order

What one authorization covers, every step free except §2.8:

1. **Before the merge** (the session):
   - nothing in flight: no Actions run in progress or queued, read twice (the
     second right before the push), and no open job in `edit_jobs`;
   - unit CI green on the candidate itself, and the site build green with the
     candidate's inputs fingerprint. At this writing: unit tests green on
     `d6de4ea9` (run 37466187566, `9592 / 9577 / 0 / 15`, the same total as
     the local run); the site build green on `49a67763` (run 37454790999),
     with nothing it reads changed since;
   - the image predicted on both ends;
   - the rollback, `git revert --no-commit d75d79f3..<candidate>`, giving back
     `main`'s own tree in a throwaway worktree;
   - the served files read before the push. Today they are deploy 2184's
     own: `chat.js` 895,780 bytes `188dc2a922bb1624…`, `edit-poll.js` 50,048
     bytes `b2a9aba6847158ec…`, `styles.css` 349,252 bytes
     `54f6dd2bc51f8b0f…`;
   - the balance and the ledger's last row read;
   - no commit carrying the skip-CI marker.
2. **The merge** (the session): `main` `d75d79f3` → the candidate, one
   fast-forward push. **The deploy is that push**: "Deploy to Cloudflare"
   runs on it by itself and takes no inputs.
3. **The deploy, read** (the session): one run, `success`; the log's `IMAGE
   SiteBuildContainer: built …:c7fe818d446dd957 (… 194 inputs …)`; the
   container's `- …:589e3e4e85a20066` / `+ …:c7fe818d446dd957`; Wrangler
   uploading `chat.js` (the one static asset that changed) and the secrets,
   `MODEL_REPLIES` and `REQUEST_FLOW` among them.
4. **The served files** (the session): `chat.js` byte-identical to the merged
   file (903,533 bytes, `dd876c6f37ce2661…`); `edit-poll.js` and `styles.css`
   unchanged.
5. **The image window**: the session waits 15–20 minutes after the image
   rolls, once, and says when it is over.
6. **The free runtime check** (the owner's press, §3.1): both readers answer
   the merged commit, a cold container answers `c7fe818d446dd957`, queued
   jobs and the runner on, nothing charged.
7. **The funds** (§5): the balance must be at least **30**, the press's
   budget. At the last reading it was 21; raising it is the owner's.
8. **The paid live check** (the owner's press, §3.2), only after 6 and 7.
9. **The readings and the record** (the session, free): the press's log and
   evidence, the site read back, the new table's row, the ledger rows by the
   press's own refs, and the records (history, deploy record, handoff,
   checklist).

A failure at any step stops the stage there, said, and nothing after it runs
without the owner's word.

## 3. The two presses' boxes

The canary workflow ("edit canary"), each box named by its description as the
form shows it. **The merged commit** is the candidate, eight characters (the
session's report names it). Every box not listed is left as it is: blank, or
its default where it has one (the site box `fretwork-1` in the free check, the
second site `washhouse-3` in both).

### 3.1 The free runtime check

"Use workflow from": `main`

"Run the ONE paid edit as well (yes/no)": `no`

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
chars). Blank = read and print only.": `<the merged commit, 8 characters>`

"Refuse to spend unless a cold container reports this image id (exact). Blank
= read and print only.": `c7fe818d446dd957`

It passes when both readers answer the merged commit, a cold container
answers `c7fe818d446dd957`, every zero-cost confirmation passes, and the
balance does not move.

### 3.2 The paid live check

"Use workflow from": `main`

"Run the ONE paid edit as well (yes/no)": `yes`

"RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …":
`lv-release`

"The site to edit. Defaults to the canary site; name another to run this
against it. Not needed with read_job.": `fold-lane-bakery`

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
chars). Blank = read and print only.": `<the merged commit, 8 characters>`

"Refuse to spend unless a cold container reports this image id (exact). Blank
= read and print only.": `c7fe818d446dd957`

"What to change", "REQUEST BATCH ONLY …", "Rules test only …", "Refuse to post
the paid edit unless the router answers this …", "Refuse to route or spend
unless one table …", "ROUTING-ONLY BATCH …", "READ ONE EXISTING JOB AND STOP
…" and "PUT ONE SAVED VERSION BACK …": blank.

## 4. The live check

### 4.1 The request

`lv-release` (`scripts/canary-ui.mjs`), in the real app in a real Chromium,
signed in as the building account, on `fold-lane-bakery` (REQUEST_FLOW on),
one message, typed and sent:

> Add a Tasting Evenings page where people can join the waiting list for our next tasting evening by leaving their name and email address, and change the Gallery page heading 'Photographs from Fold Lane' to 'Photographs from our ovens'.

The heading is the live page's own today (read at this writing: `/gallery`
"Our Gallery", then "Photographs from Fold Lane"). The tab stays open while
the request runs. Before the message, the press reads the balance and sends
nothing unless it covers the budget of 30 (`fundsFirst`).

### 4.2 What must hold

**It passes when every check passes** (the press prints each one):
- **the request**: one routing call with the message's words; taken on as a
  request; every part ended done at a route the press allows (text, look, nav
  or page for the heading; the add-on step for the page); nothing stopped by
  the press's wall;
- **the pages**:
  - one new page about tasting, stored and served 200;
  - every page's menu gained a link whose words include "Tasting", pointing
    at it, each keeping its own items, and every served header links it;
  - `/gallery` reads "Photographs from our ovens";
  - every other stored page, component, logo and the description as they
    were;
- **the table**: exactly one new table, which visitors can send to and nobody
  can read (`collect`), with an email column; every other table as it was;
- **the replies**: every reply the model's own, on screen;
- **the money**: the press's own charges (routing by its keys, jobs by
  theirs) add up within the balance's move;
- **the form** (§4.3, corrected in §4.4), each its own check:
  - the new page has one form, with a name and an email field;
  - which column of the new table each entry belongs in, established from
    the form's own fields and the table's columns before anything is
    pressed. Where it cannot be, nothing is pressed and the check fails as a
    limitation of the check, never a pass;
  - exactly one request, to the new table's own data route, leaving the
    browser, with each entry under its own column and nothing else;
  - the site takes it (HTTP 2xx);
  - the new table held no row before, and holds exactly that one row after,
    read by the owner's own route, each entry in the column its field is
    bound to and in no other.

**Read by the session afterwards** (free, recorded, not checks of the press):
- the screenshots of every page in the press's evidence;
- the job's stored answer: each requirement the designers wrote, the real
  judgment's verdict on it, and how each was told;
- the model's reply text: what it says each requirement came to. The form
  step shows whether "each entry is kept" holds in fact.

### 4.3 The form step (prepared on the branch)

After the request's checks, only in the paid press, and only once those
checks found the new page and exactly one new, empty table:
- **a visitor's browser** (a context of its own, signed in to nothing, service
  workers blocked) opens the new page and reads its one form;
- **the fill**: the email field gets `canary-release-<run>@example.com` (a
  domain reserved for examples, so no mail reaches anybody), the name field
  `Canary release <run>`, a required sentence field `Canary release check
  <run>`, a required box a tick. `<run>` is the workflow run's id. A field it
  cannot fill truthfully (a choice, a date, a number, a phone number) presses
  nothing and says which. So does a page with no form or several, or values
  that do not hold;
- **the binding** (§4.4): before anything is typed or pressed, each field
  the fill uses is bound to its column of the new table, from the field's
  own name, id and label and the table's columns. Where that cannot be
  established, nothing is pressed and the press says it is a limitation of
  the check;
- **the gate**: the form's one request leaves the browser only if, before it
  leaves, it is the first, goes to the new table's own route, carries no
  query string, credential or `prefer`, and holds each entry under its own
  column and nothing else. Anything else is stopped and recorded, never
  rewritten;
- **the read-back**: the new table is read by the owner's route before
  (empty) and after (exactly that one row, each entry in its own column and
  in no other).

It costs nothing: no model is called, and the site's own data route takes the
entry. Shown with a real Chromium against pages served in the tests
(`test/canary-form.test.mjs`): the paid send, a rehearsal, a refused body, a
credential, an unfillable field, two forms and a field that does not hold;
since §4.4, also a swapped and a misplaced send, renamed columns named by the
fields and not, and a table whose columns cannot be told apart. The first
sweep (35 mutants, all caught) and suite (`9587 / 9587 / 0 / 0`) were before
§4.4; the current ones are in §4.4.

### 4.4 The correction after Codex's review (`fb42ff16`)

Codex ran `formGate` and `formVerdict` at `fb42ff16`, and both passed a
payload and a row that must fail: the name and the address swapped, and both
empty with the marker's values in unrelated `note` and `source` columns. The
gate and the row check asked only whether each value was somewhere in the
object. **Reproduced here first**, on the ordinary form (`name`, `email`)
and on renamed columns (`full_name`, `email_address`): all four passed both.

**Now each entry is judged where it belongs** (`fieldBindings`, in
`scripts/canary-form.mjs`), from evidence the press holds before it presses
anything: the form's own fields as the visitor's browser reads them (each
field's name attribute, id, label and type), and the new table's columns
from the owner's listing (its declared, writable columns):
1. a field whose name, id or label is one column's name, case and
   punctuation aside, is bound to that column (`email_address`,
   `emailAddress` and "Email address" are one name);
2. otherwise, for the name and the address only, the table's one column for
   it: the one column with "email" in its name, or the one with "name". A
   required sentence or box has no such reading, and must name its column.

**Not established, and said so**: no columns read; a field naming two
columns, or matching several; no column, or several, for a name or an
address that no field names; a sentence or a box naming no column; the
address field named after a column for a name, or the reverse; one column
bound to two fields. The browser then presses nothing, the press prints
"verification limitation: …", and the form step fails. It never passes.

Then **the gate** requires the body to carry each entry under its bound
column (the value typed, or `true` for a box ticked) and nothing else but
empty values, and **the row check** requires each bound column of the stored
row to hold its entry, and no other column to hold one. Nothing in it knows
a site, and no column is expected to be called `name` or `email`.

**Shown** (no model, nothing live):
- **before and after**, the same payloads and rows through `fb42ff16`'s
  harness and this one:

  | Form | Payload and row | `fb42ff16` | now |
  |---|---|---|---|
  | ordinary (`name`, `email`) | swapped | gate passes, row passes | gate stops, row fails |
  | ordinary | misplaced in `note`, `source` | gate passes, row passes | gate stops, row fails |
  | ordinary | each in its own column | gate passes, row passes | gate passes, row passes |
  | renamed (`full_name`, `email_address`) | swapped | gate passes, row passes | gate stops, row fails |
  | renamed | misplaced in `note`, `source` | gate passes, row passes | gate stops, row fails |
  | renamed | each in its own column | gate passes, row passes | gate passes, row passes |

- **the tests** (`test/canary-form.test.mjs`, 16 cases, 5 of them new):
  - BIND 1, the bindings: the ordinary form; renamed columns named by a
    name attribute, by an id in another case and by a label; renamed
    columns no field names, found as the table's one name and one email
    column; a sentence and a box; and each way a binding is not
    established, saying what could not be told;
  - BIND 2, the gate: both payloads stopped on the ordinary form and on
    renamed columns (named and not), naming the column and what it
    carried; an entry sent under its own column and another; a renamed
    table sent the old keys; the three controls leave;
  - BIND 3, the stored row: both rows fail on each form, saying where; a
    stray copy in another column; a column the row does not have; the
    controls pass, naming each binding; without bindings the row is not
    checked and the step fails as a limitation, even beside a row that holds
    every value;
  - FORM 8, in a real Chromium against pages served in the test: a page
    whose own code swaps the two, or sends them under `note` and `source`,
    is stopped before anything leaves; renamed columns named by the fields
    send one exact entry and the row read back passes (the same row swapped
    or misplaced fails); renamed columns no field names send one exact
    entry; the same page with its keys swapped in its code is stopped; a
    table with two columns for a name presses nothing, said as a
    limitation;
  - WIRE 3: the helper binds after reading the form and before filling or
    pressing, stops there, and hands the gate the bindings;
  - FORM 4–7 and WIRE 1 brought to the bindings (the driver hands the
    helper the table's columns);
- **the sweep**: 60 of 60 planted defects caught
  (`scripts/mutants/release-form.json`), the 3 comment-only controls
  surviving. Two of them, R1 and R2, put the old "somewhere in the object"
  check back into the gate and the row check, and both are caught. The first
  run caught 59: the one that survived, two new rows passing as one, was a
  guard written twice, so that each copy hid a defect in the other. It is now
  one term, and the rerun caught all 60;
- **the full suite**: `9592 / 9592 / 0 / 0` here (9,587 plus the 5 new cases);
- **CI**: unit tests green on `d6de4ea9` (run 37466187566): `9592 / 9577 / 0
  / 15`, the same total as here. CI has no Chromium, so the browser cases
  skip there (15 skipped, 14 before FORM 8; by the count). The site build
  was not owed a run: nothing it reads changed since its green run on
  `49a67763` (run 37454790999).

**What the bindings still trust** is the form's own words: a field whose
name, id or label names a column is taken to be meant for it, and a lone
column with "name" or "email" in its name is taken to be the one for it. The
gate and the read-back then check what the page really sent and stored
against that. A page whose fields name no column, on a table with two
columns for a name, ends as a limitation rather than a guess.

## 5. The cost, against the balance of 21

| Part | Measured on the same shape | Estimate |
|---|---|---|
| routing, one call | run 101 message 1: 3; R2: 3; R5: 1 | 1–3 |
| the add-on: a page with a form and its own table, its menu link the builder's | run 101 message 1: 16 (7 + 9) | 12–17 |
| its requirement judgment, new since run 101 | estimated ≈0.4–0.7 credit per call, rounded into the add-on's bill | +1 (up to +2) |
| the second part's own routing job | run 101: 3; R5: 1 | 1–3 |
| the heading | run 101: 2; R5: 2 | 2 |
| the form step and every read | no model call | 0 |
| **in all** | | **about 17–27; most likely about 25** |

**The balance was 21** at the last reading (10:37 UTC on 6 October; last
ledger row 392, no job queued or running). **That does not cover the most
likely cost**: run 101's first message, the same shape, cost 24 before the
judgment existed. A request the server has taken on runs to its end whatever
the balance. Started short, its last part would be refused for want of
credits, on the live site, after the rest had been paid for. So the press
carries a budget of 30 and, before it sends anything, refuses unless the
balance covers that budget (`fundsFirst`, new: §4.3's commit). At 21 it stops
there, with nothing sent and nothing charged. **The balance needs to be at
least 30 before the press**: 35 leaves room above the estimate's top.
Raising it is the owner's. The deploy, the runtime check and the form step
cost nothing. An estimate, not a cap: nothing enforces a per-request limit.

## 6. What the evidence is, kept apart

### 6.1 Shown by controlled tests only (supplied model answers, failures made on purpose; not live)

Each of these is shown through the real routes, the poll route, the browser's
own composer and a request's background reply, in the unit suite, and **none
is exercised by the live check**, which is a success path; nothing is made to
fail on a live site:
- **a failed addition's outcome**: no change, part of it live by name, saved
  but not live, not known. That covers the publish failing before or after its
  database change, an apply stopping part-way, a design kept, photographs
  kept, a database made beside each, a database that could not be made, and a
  model call that failed;
- **the wording beside them**: no "untouched" over changes that went in, the
  migration sentence naming only this change's tables, "nothing from this is
  stored" only where nothing ran;
- **refusals**: a designer's refusal, every designer declining, the code
  dependency refusal, each telling its requirements;
- **the warning lists** above their old cuts: missing pages, codes, seed
  skips, empty tables;
- **the requirement judgment's failures**: an empty, partial or cut-off
  verdict list stopping the add-on (the incomplete judgment);
- **answers stored before these fixes**, replayed by the poll route, the facts
  and the browser.

### 6.2 What the live check would prove

On the deployed code, with real models and real money:
- **the success path end to end**: routing, the request driver with its parts,
  the add-on making a page with a form and a table, the edit, the publish,
  the menu link on every page;
- **the requirement judgment's first live run**: the real model's verdicts on
  the designers' requirements, read back from the stored answer;
- **the requirement facts and the model-written replies**, live: what the
  reply says each requirement came to;
- **the resulting pages**, as a visitor is served them;
- **the new form working**: a visitor's entry, sent once through the page's
  own form, stored in the new table with each value in the column its field
  is bound to. That shows the add-on's "each entry is kept" in fact, beyond
  "set up";
- **the release itself**: the new image and the new `chat.js` serving.

### 6.3 What it does not prove

- **No failure path**: no refusal, failure outcome, incomplete judgment or
  warning list is reached, by design.
- **No replay of an older stored answer**: none is involved.
- **One request on one site, one sample**: how often the router, the
  designers and the judgment answer this way is not measured.
- **The form's request with a member's session**: the entry is a visitor's.
- **The binding rules on another form**: they are shown in controlled tests
  (§4.4). If the live page's fields name no column and its table has two
  columns for a name, the press reports a limitation of the check, not a
  pass.

## 7. What stays, and if it fails

- **What stays** (the demo-site rule): the Tasting Evenings page, its table,
  its menu link, the Gallery heading, and the one marker entry in the new
  table. The press writes that one entry and nothing else. Taking it out
  later is a row write and the owner's (the Data panel), not part of this
  stage.
- **If a check fails**: the record says which and why; nothing is pressed
  again, repaired or put back without the owner's word. A saved version can
  be put back free for the pages (the restore box); a table and its row are
  not removed by that.
- **If the merge or the deploy fails**: nothing is pressed; the rollback is
  the revert verified in §2.1.

## 8. Parked, not in this stage

- The unrelated backlog and the twelve-requirement intake limit.
- The planned model-written progress updates.
- First Build and RW.
- `/starter` on the live bakery reads "This page isn't finished yet" (seen
  while reading its headings for §4.1). It is unrelated to this release and
  not investigated.
