# The combined release and its one live check: one stage to authorize (2026-10-07)

The owner, after Codex reviewed `092ff48a` and passed 90 assertions against
the provisioner and the project search: *"Preserve these fixes and close the
remaining verification gate without starting another product audit. … In the
same handoff, prepare the concrete release and combined Edit/Add-on
verification plan: exact commits and predicted image, one container build if
required, the smallest useful set of live scenarios covering mixed requests,
dependency order, clarification, model-written progress, closed-tab
completion, final results and charges, with the expected credit budget and
stop conditions. Keep deliberate provisioning failures in offline tests. Do
all preparation now, but keep the branch unmerged and do not deploy, build the
container image, provision live resources or run paid tests until I approve
that release plan."*

**Status (2026-10-07, prepared, not pressed).** Nothing was merged, deployed,
built or pressed, and nothing was spent. The press is a new canary scenario,
`lv-combined` (§4), prepared on the branch with this plan. **Two things stand
between this plan and its first step**: the site build's re-run (§2.1, the
owner's press: the session's re-run answered 403) and the owner's approval.

**In one view:**
- **The release**: one fast-forward of `main` (`bcc22295` → the candidate)
  and the one deploy that push starts. It builds the container image once,
  **`5f946c22d42a1b10` → `335396c8c0e0fbcb`**. Progress stays on: the secret
  `PROGRESS_REPLIES` has been `on` since deploy 2187, and nothing here
  changes it.
- **The live check**: one press of `lv-combined` on `fold-lane-bakery`,
  three messages in one browser run (§4.1):

  > Put a link to the new Allergens page in the menu, and add an Allergens page saying all our loaves are baked in one kitchen that also handles nuts, seeds and dairy, so we can't promise any loaf is free of them, and that anyone with an allergy should ask us at the counter.

  > Change the Order page heading 'Pick a loaf and a collection slot' to 'Choose your loaf and a collection time', and add a link to our TikTok in the footer.

  > It's tiktok.com/@harbourloaf

- **The money**: about **28 credits** expected (22–38). **The budget, 38**:
  the press sends nothing unless the balance covers it. **The hard cap,
  40**: raise the balance from 10 to exactly 40, and no charge can take it
  below zero (§5).

## 1. What is released

**The candidate** is the branch's tip at the merge. `main` is `bcc22295`
(deploy 2186, image `5f946c22d42a1b10`; switched by deploy 2187), an ancestor
of the branch, so the merge is one fast-forward. At this writing the branch is
`main` plus 33 commits to `092ff48a`, then this preparation's own (§9):

| Commits | What | Review |
|---|---|---|
| `d09f5d7e` … `006d0e0a` (6) | the records of deploys 2186 and 2187, run 104 and run 105; the canary's menu-label rule (`bd192acc`) | docs, and the canary only |
| `0ee8e782` … `430a3a64` (10) | the owner's Edit/Add-on cleanup batch: progress clarity, failure and partial exits, no silent losses, data-change precision, late provisioning, completion display, narration usage | the owner; Codex's findings on `430a3a64` |
| `71e47213` … `6945ab3a` (11) | the correction round: provisioning recovery, partial evidence end to end, typed data-change equality, seed outcomes, table inventory, rejected columns, late undo, two tabs, the preview browser test | Codex |
| `dc531bef`, `320d6767`, `a921a64d`, `78a83b39` | the follow-up pass: put-back offers checked against the table, late undo before a request's first job, rejected columns for the page writer | the owner |
| `570adb45`, `092ff48a` | the recovery correction: an uncertain create keeps its note and stops a second; an unfinished listing is never absence | **Codex, at `092ff48a`: 90 assertions passed** (uncertain creation, delayed visibility, repeated retries, eventual adoption, reuse, incomplete pagination) |
| this preparation (§9) | `lv-combined`, the canary's order check reading the card of a fresh-session message, the canary form, this plan and the records | for review with this plan |

**What reaches production**:
- the Worker: `worker.js`;
- the container: `builder/request.mjs`, `builder/seed-rows.mjs` (new),
  `builder/site-add.mjs`, `builder/site-addon.mjs`, `builder/site-apply.mjs`,
  `builder/site-migrations.mjs`, `builder/site-progress.mjs`,
  `builder/site-reconcile.mjs`, `builder/site-reply.mjs`,
  `builder/site-requirements.mjs`, `site-backend-state.mjs`, `site-db.mjs`,
  `site-provision.mjs`, `site-schema-recover.mjs`, `site-schema.mjs`, and
  the `Dockerfile`, which copies the new module;
- one served file, `public/chat.js`.

The canary scripts, the canary workflow, the tests and the docs deploy
nothing.

**The one container image build**: `5f946c22d42a1b10` (live; 195 inputs,
165 paths) → **`335396c8c0e0fbcb`** (196 inputs, 166 paths), predicted on
both ends with the deploy's own functions. Seventeen inputs differ: the new
`builder/seed-rows.mjs`, and the sixteen changed files above (none under
`public/`). It is predicted again at the final candidate before the merge;
none of this preparation's files is an input.

**The served file**: `chat.js` is served today as `main`'s, 920,280 bytes,
`0e68e3242f209272…` (read 20:41 UTC); the merged file is 939,255 bytes,
`dfa075929c9889e0…`.

## 2. The stage, in order

What one authorization covers. Every step is free except §2.8.

1. **The site build's re-run** (the owner's press): *Actions → site build →
   run 37674861320 → Re-run jobs → Re-run failed jobs*. On `570adb45` four
   jobs stopped at their 20-minute limit while apt installed Chromium's
   packages, before any of their tests ran; the session's one re-run request
   answered 403 (*"Resource not accessible by integration"*) and was not
   tried again. The session then reads the run: every job `success`, the gate
   (`all checks`) green with four shard reports, every section run once in
   its shard, and the inputs `de6345b9058cd1cc` (3,974 files). If the
   Chromium install stalls again, the session diagnoses that setup step and
   makes a focused correction, keeping every test and its assertions.
2. **Before the merge** (the session):
   - nothing in flight: no Actions run in progress or queued, read twice
     (the second right before the push), and no open job in `edit_jobs`;
   - unit CI green on the candidate itself, with the same total as the local
     run; the site build's gate green with the candidate's inputs
     fingerprint (`de6345b9058cd1cc` at `570adb45` and at `092ff48a`, and
     unchanged by this preparation, whose files are none of its inputs —
     read again on the candidate);
   - the image predicted on both ends: `5f946c22d42a1b10` →
     `335396c8c0e0fbcb`;
   - the rollback verified in a throwaway worktree: `git revert --no-commit
     bcc22295..<candidate>` gives back `main`'s own tree;
   - `chat.js` as served read before the push (today `0e68e3242f209272…`);
   - the balance and the ledger's last row read (today 10, row 401, no job
     open, read 20:42 UTC);
   - no commit carrying the skip-CI marker.
3. **The merge** (the session, on the owner's word): `main` `bcc22295` → the
   candidate, one fast-forward push. **The deploy is that push**: *Deploy to
   Cloudflare* runs on it by itself and takes no inputs.
4. **The deploy, read** (the session): one run, `success`; the log's
   `IMAGE SiteBuildContainer: built …:335396c8c0e0fbcb (… 196 inputs …)`, the
   container's `- …:5f946c22d42a1b10` / `+ …:335396c8c0e0fbcb`; Wrangler
   uploading `chat.js`; `PROGRESS_REPLIES` printed masked, as since deploy
   2187 (a fallback would print plain `off`: then the session stops and
   asks).
5. **The served file** (the session): `chat.js` byte-identical to the merged
   file, 939,255 bytes, `dfa075929c9889e0…`.
6. **The image window**: the session waits 15–20 minutes after the image
   rolls, once, and says when it is over.
7. **The free runtime check** (the owner's press, §3.1): both readers answer
   the merged commit, a cold container answers `335396c8c0e0fbcb`, queued
   jobs and the runner are on, and nothing is charged.
8. **The funds** (the owner, §5): raise the balance to **exactly 40**. Add
   nothing while the press runs.
9. **The paid live check** (the owner's press, §3.2), only after 7 and 8.
10. **The readings and the record** (the session, free): the press's log and
    evidence; the site read back; the two requests' records and their jobs in
    `edit_jobs`, by id, for the order the parts ran in; the ledger rows by
    the press's own refs; the narration's usage (the canary's step after the
    press); and the records (history, deploy record, handoff, checklist).

A failure at any step stops the stage there, said, and nothing after it runs
without the owner's word.

## 3. The presses, box by box

The canary workflow is *edit canary*. Each box is named by its description,
as the form shows it. **The merged commit** is the candidate, given as eight
characters (the session's report names it). Every box not listed is left as
it is: blank, or its default where it has one.

### 3.1 The free runtime check (after step 6)

"Use workflow from": `main`

"Run the ONE paid edit as well (yes/no)": `no`

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
chars). Blank = read and print only.": `<the merged commit, 8 characters>`

"Refuse to spend unless a cold container reports this image id (exact). Blank
= read and print only.": `335396c8c0e0fbcb`

It passes when both readers answer the merged commit, a cold container
answers `335396c8c0e0fbcb`, every zero-cost confirmation passes, and the
balance does not move.

### 3.2 The paid live check (step 9)

"Use workflow from": `main`

"Run the ONE paid edit as well (yes/no)": `yes`

"RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …":
`lv-combined`

"The site to edit. Defaults to the canary site; name another to run this
against it. Not needed with read_job.": `fold-lane-bakery`

"Refuse to spend unless the Worker reports this deploy sha (prefix, >=7
chars). Blank = read and print only.": `<the merged commit, 8 characters>`

"Refuse to spend unless a cold container reports this image id (exact). Blank
= read and print only.": `335396c8c0e0fbcb`

"What to change", "REQUEST BATCH ONLY …", "Rules test only …", "Refuse to post
the paid edit unless the router answers this …", "Refuse to route or spend
unless one table …", "ROUTING-ONLY BATCH …", "READ ONE EXISTING JOB AND STOP
…" and "PUT ONE SAVED VERSION BACK …": blank.

## 4. The live check

### 4.1 The messages, and what each is for

One press, three messages, in one browser run on the bakery. Each is a path
an earlier press proved live (runs 95, 99 and 105), none repeated as it was,
and every change is fresh: no earlier scenario asked for an Allergens page, a
TikTok link or the Order page's heading (a test holds it).

| What the owner asked to cover | Where | How it is judged |
|---|---|---|
| **Mixed requests** | message 1 (a page from the add-on step, its menu link from the menu step) and message 2 (a heading through an edit, a footer link handed from the add-on step to the menu step) | every part of each request done, each at a route the press allows; the coverage `edit-and-addon` |
| **Dependency order** | message 1: the link is named before the page it needs (R1's order, run 95) | **the check that no part started before a part it needs had finished**, against every reading of the request — the requests list while the tab is closed, and now the card's readings in the sending tab and the fresh session (§9) — once the router names the order; the coverage `waits-for-prerequisite` says whether it did |
| **Clarification** | message 2: the link's step asks for the TikTok address, the heading already done; message 3 answers it | message 2 must end on one part waiting with the step's question, the page showing it and nothing else running; the coverages `step-question` and `answer-resumes` |
| **Model-written progress** | message 1: the page is the long part (run 105's add-on took 7.5 minutes) | the eight progress checks: a line live on its own running part in the tab that sent it, before the end; each part named by the model's own line for its state |
| **Closed-tab completion** | message 1: the tab is closed once a line shows; the list alone is read; a fresh browser session, signed in afresh, finds the request and follows it to its end | the same eight checks; messages 2 and 3 go from the fresh session's tab |
| **Final results** | after the press | the new page found by its own words (*kitchen*, *dairy*: its name is in every header), served 200; its link in every menu that lacked it, every menu keeping its own items; the Order heading's words; every footer gaining the one TikTok link to `tiktok.com/@harbourloaf`, keeping its links; everything else byte for byte as it was, tables and components included; each part's reply the model's own and on screen |
| **Charges** | after the press | the money check: the press's own routing charges and job reserves, read by their refs, equal its balance's move; narration adds no charge |

**Why message 1 is not the question's**: the canary ends a question's message
only once nothing else is running (`questionShown`), and the page would be.
So the question has its own message, as in R3, and the long page stays in
message 1 where the progress and the closed tab are judged.

**No form and no table**: nothing is provisioned, and the bakery's tables
must end as they began. Deliberate provisioning failures stay in the offline
tests (`test/late-provision.test.mjs`, `test/site-provision.test.mjs`,
`test/addon-failure-outcome.test.mjs`).

### 4.2 What the press does, in order

1. **Its preflight, free**: both readers answer the merged commit and a cold
   container the image, or nothing is sent; every zero-cost confirmation;
   the site's before-read (stored pages, served pages, components, tables).
2. **Before message 1, free**: progress on (the requests list carries
   `jobs`), or nothing is sent; the balance at least 38 (the budget) and at
   most 40 (the hard cap), or nothing is sent.
3. **Message 1**, `away: "fresh"` (bound 14 minutes): sent; the sending tab
   watches the card until a progress line is live on its own running part,
   then is closed; the requests list alone is read for 30 seconds; a fresh
   browser session opens the site and follows the request to its end, every
   reply on screen.
4. **Message 2**, from the fresh session's tab, `until: "question"` (bound 6
   minutes), only if the press has spent less than 38: it ends once one part
   waits on the step's question, the page shows it, and nothing else runs.
5. **Message 3**, the answer (bound 7 minutes), only if message 2 ended on
   that question and the press has spent less than 38: the request resumed
   and followed to its end.
6. **After**: the site's after-read; the verdict; the money; the narration's
   usage (the next step of the workflow).

### 4.3 What must hold

Every check in §4.1's table, and every check the canary makes of a request
press (one routing call per message carrying its words exactly, no edit
posted by the page, nothing stopped by the wall). The coverages are recorded,
never failed on: the same outcome may come by another path.

### 4.4 What stays

The new page, its links, the heading and the footer link stay on the bakery
(the demo-site rule). Nothing is restored.

## 5. The cost, the budget and the hard cap

| Message | Measured on | Expected |
|---|---|---|
| 1: the link and the page | run 95's R1 without its description: routing 3, the page's routing 1 and its add-on 12, the link's routing 3, its menu step refunded; the add-on's requirement judgment about 1 more; run 105's add-on 14 | 16–26 |
| 2: the heading and the footer link, to its question | run 99's R3: routing 3, the heading 2, the link's routing 1 | 4–8 |
| 3: the answer | run 99's R3: routing 1, the footer link 1 | 2–4 |
| **The press** | | **22–38, most likely about 28** |

- **Narration** is the platform's, never charged to the account.
- **The budget, 38**: the press sends nothing unless the balance covers it,
  and sends no later message once it has spent 38.
- **The hard cap, 40**: every charge refuses what the balance cannot cover,
  so the balance at the press is the most it can spend. The press sends
  nothing while the balance is above 40.
- **The balance** was 10 at the last reading (20:42 UTC, ledger row 401, no
  job open): **raise the balance from 10 to exactly 40**.
- An estimate is not a cap; the cap is the balance.

## 6. The stop conditions

**Built into the press** (each said by name in its log and record):
- the Worker or a cold container not on the merged commit and the image:
  nothing is sent;
- progress off: nothing is sent;
- the balance below 38 or above 40: nothing is sent;
- before messages 2 and 3, the press having spent 38: nothing more is sent;
- a part routed where the press does not allow it (any layer but text, look,
  nav and page, besides the add-on step), or waiting for a rewrite's go-ahead:
  that part is stopped through the request's own Stop;
- message 2 ending without the question: message 3 is not sent;
- a message passing its bound with its request still running: its outcome is
  unknown, and nothing more is sent.

**For the stage**: any failed step stops it there; a failed press is
recorded and judged, never pressed again without the owner's word; nothing is
restored; and the session spends nothing itself.

## 7. What the evidence is, kept apart

**Shown by offline tests only** (supplied model answers and failures made on
purpose; never live): every provisioning failure — an uncertain create, a
create that lands late, a repeated cursor, a refused create, a failed drop —
and the recovery rules for them; the failure, stop and crash exits; the late
undo against newer work; rejected columns; two tabs.

**What the live check would prove**: the paths in §4.1, once each, with a real
router, real pickers, the real add-on step, real progress narration, the real
page and browser, and the real ledger.

**What it does not prove**: any provisioning failure or recovery; a form or a
table; data, rules, picture or logo edits; a full rewrite; a question the
router itself asks; how often a real model takes these paths.

## 8. The limitations, stated plainly

- **An uncertain database creation can require manual settlement.** A create
  Neon answered with anything but its own refusal, whose project never shows
  under its attempt's name, keeps that site from making a database until the
  owner settles the note by hand (`docs/owner-notes.md`'s handoff says how).
  This press provisions nothing, so it cannot meet it.
- **Dependency order is judged only where the router names it.** If the
  router puts the link and the page in no order, the order check holds
  vacuously and the coverage says so; the session then reads the order the
  jobs ran in from `edit_jobs` (§2.10).
- **The question depends on the model.** If the link's step invents an
  address instead of asking, message 2 ends without a question and message 3
  is not sent: the press fails on that, said.
- **Progress depends on the narration.** A part that finishes between two
  milestones has no line of its own; the coverage `progress-each-part` records
  it, and the checks need one live line on a running part before the end.
- **Time**: the three messages' bounds and their reply floors take the press's
  whole 30 minutes; a page build much slower than run 105's would pass message
  1's bound, and nothing more would be sent.
- **The site build's gate** is not green yet (§2.1).

## 9. This preparation's commits

On the branch, for review with this plan (the session's report names them):
- **`lv-combined`** (`scripts/canary-ui.mjs`) and the canary form's entry for it
  (`.github/workflows/edit-canary.yml`, its box's description and the note
  above it);
- **the order check reads the card of a fresh-session message**
  (`scripts/canary-requests.mjs`, `jobOrderVerdict`): such a message's own
  route is read only through the requests list while its tab is closed, so
  before this the order rested on those few readings; now every reading of the
  card, in the tab that sent it and in the fresh session, is checked too;
- the tests: `test/canary-combined.test.mjs` (the scenario, its freshness, this
  plan and the form, the press driven end to end through the stand-in app, an
  out-of-order link, and each stop condition), the order check's card cases in
  `test/canary-requests.test.mjs`, and the scenario lists in
  `test/canary-form.test.mjs` and `test/canary-menu-label.test.mjs`;
- this plan, and the records.
