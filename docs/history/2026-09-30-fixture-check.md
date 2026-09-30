# Run 77's review, the £40 put-back's trace, and the canary's fixture check (2026-09-30; the check on the branch, not merged)

## The owner's request

Owner, 2026-09-30, after run 77: *"Keep run 77 as a failed deletion
acceptance. Credit its correct live routing and refunded no-match result
separately. Before another paid run, address these two points using free
work: 1. Diagnose why the reported £40 restoration did not land. Trace the
actual Data panel save request, response handling, and database target.
Don't assume user error or declare an application bug without evidence. If
you need my observation, ask specifically for the Save result and the value
after reopening the panel. Don't perform another live write. 2. Add the
smallest generic, opt-in fixture precondition to the existing canary. It
must verify the expected baseline and target row before the first paid
routing/model call. Missing, mismatched, or unreadable setup must stop at
zero cost. No fixture-specific product rules. Cover rejection and
valid-setup controls with focused tests. Push any changes for review; no
merge, deployment, paid call, or live database write. Only prepare another
deletion run after the price recovery and temporary row have both been read
back and verified. Keep accepted tests closed."*

## Run 77, as reviewed

**A failed deletion acceptance.** The press ran before its temporary row
existed and with B2's recovery open, so no row was deleted. The deletion
itself is still unshown: the picker answering `remove` for exactly the named
row, and the job deleting it through the blank link.

**Credited separately, as the owner asked:**
- **its correct live routing**: the real router, told the site's four table
  names by the route (`tablesFilled`, Lane 1d's first live reading), answered
  `data` for a row taken off the list, with nothing held back. This is the
  first real-router reading of deploy 2172's row-removal routing, and one
  sample;
- **its refunded no-match result**: the data step found no such row and said
  so (422 `no-match`), and the job's reserve came back. Ledger row 343 is the
  reserve (−1), and row 344 the refund (+1). The edit cost 0, and routing
  cost 2 (15 → 13).

## 1. The £40 restoration that did not land: the save path and the logs (free; no live write; not settled)

### The save path, traced in the code

- **The browser** (`public/chat.js`, `loadSiteData`, lines 7027–7042):
  - Save collects the form's fields (the table's declared columns, managed
    ones left out) and sends `PATCH /api/site/<slug>/rows/<table>/<id>` with
    the row as JSON, from the signed-in app (`apiFetch`, the session's
    token).
  - A reply that is not 2xx shows its `error` (or *"Couldn't save that."*) as
    a toast and keeps the form open.
  - A 2xx closes the form and reloads the table from the server
    (`GET /api/site/<slug>/rows/<table>`), so what the panel shows after a
    Save is the database's own answer.
- **The Worker** (`worker.js`, the owner routes block, and `site-owner.mjs`
  `handleOwnerWrite`):
  1. `authUser` asks Supabase `GET /auth/v1/user` with the session's token.
  2. `assertOwner` asks Supabase
     `GET /rest/v1/site_backends?slug=eq.<slug>&select=uid`.
  3. `dbFor` is `ownerSiteConn` (Lane 1c): `siteBackendBySlug` first (the KV
     route cache, then Supabase), then the four-state reader, read-only.
  4. The write is `UPDATE "<table>" SET … WHERE id=?`. No row changed answers
     404 *"no such row"*; otherwise the row is re-read and answered 200.
- **The database target.** The owner route resolves through the same
  `siteBackendBySlug` as the site's own read (`proxySiteService`, which then
  reads the Data API address from that database's `_meta`). The edit job's
  database (`siteBackendDetail`: `site_project`'s project, and
  `dbNameForSite("fretwork-1")`, which is `site_fretwork_1`) is the one the
  site's read reflects: B1's job write showed there. The project and branch
  given for the console fallback match `site_project`: `super-hat-47366810`
  and `br-long-bird-aukew6zm`.
  - Not measured for fretwork-1: whether the owner route's rows and the
    site's read agree. The fixture check below reads only the site's own
    read (it says why), so it does not measure this either; the owner's
    observation is what settles it.

### What the logs show (Supabase's own request logs; non-secret fields only)

Every panel request makes two Supabase calls before anything else: the
session check (`/auth/v1/user`) and the owner lookup
(`site_backends?slug=eq.<slug>&select=uid`). Both are in Supabase's request
log with a timestamp, and the session check carries the account.

In the 24 hours to 17:25 UTC, 2026-09-30:
- **every session check for the building account** falls inside a canary run
  (runs 65–77: 21:51, 21:56–22:00, 22:23, 00:27, 00:33, 00:37,
  01:05–01:06, 01:18–01:21, 02:11, 02:21, 07:49–07:50 and 08:28–08:29), and
  there are none outside them;
- **every owner lookup for fretwork-1** is a canary run's (00:xx–02:xx and
  08:28–08:29) or my own public page render (08:19, a different query that
  takes the owner too). Between 07:00 and 08:19 there is none;
- **every sign-in to the building account** is a canary run's own, one per
  run; there is no other sign-in by any account. A private window's sign-in
  would be one;
- **the site list** (`site_backends?uid=eq.…`, which the app reads on
  opening) was not read at all.

The canary runs are the positive control: the same queries appear, with
their times, exactly when a run made them.

**What the logs can and cannot say** (corrected after the owner's review,
2026-09-30; the first wording said no Data panel request reached the Worker,
which these logs cannot prove):
- no session check and no owner lookup from the Data panel appears in them
  for that window, and the canary runs show that such calls are kept;
- that fits no Save reaching the Worker, but it does not prove it. A request
  that stopped before those two calls would leave nothing there: one that
  never left the browser, one the network or the Worker failed early, or one
  the logs did not keep;
- so neither a user error nor an app defect is shown.

**What would settle it is the owner's observation**: what Save displayed (a
message, an error or nothing), and the price row 4 showed after the panel was
closed and opened again.

## 2. The canary's fixture check (`3229272e`, on the branch, not merged)

**Why.** Nothing in the canary read the rows a data press is written for, so
run 77 bought the routing call for a deletion of a row that did not exist.

**What it is.** A new form box, `expect_rows` (*"Refuse to route or spend
unless one table, read as the site serves it, is as named: JSON …"*), and a
module, `scripts/canary-fixture.mjs`. Generic: nothing names a site, a table
or a sentence.
- **The box** is one JSON object with exactly three keys:
  - `table`: the table's name;
  - `baseline`: 16 to 64 hex characters, the start of the sha256 of the
    table's rows **other than the target**, in canonical form (keys sorted,
    rows by id, values' types kept);
  - `target`: the fields of the one row the message is about. At most 20,
    each a string, a number, a boolean or null.

  A malformed box, and one beside a read, a restore or a scenario, refuses
  before the sign-in, with no network call (exit 2).
- **The check** reads the table as the site's own read serves it
  (`/api/db/<slug>/data/<table>`, through `readRowList`). The first failure
  decides:
  - `unreadable`: the read did not answer with a whole row list (a refusal,
    no answer, a page, an object, an id twice or a row without an integer
    id);
  - `target-missing`: no row has every target field with the same value and
    type. A column the row lacks never meets a `null`;
  - `target-ambiguous`: more than one row does;
  - `baseline-mismatch`: the other rows do not digest to the named start.
- **Where it sits.** Below the free checks, the inventory and the balance,
  and **above the restore and scenario modes and the spend switch**:
  - with spend `no` the check is the whole run, a free rehearsal;
  - with spend `yes`, a setup that is not as named exits before the routing
    call, at no cost (exit 1).

  The reading is written first, to `fixture.json`, with the rows the site
  served (which its pages serve to anyone).
- **Its limits.**
  - A table the site does not serve (one only its owner can read) is
    `unreadable` here, so the check cannot be used for it.
  - The read was taken as one answer, and any 200 list was believed. **The
    owner's review found the false pass this left** (an answer leaving a row
    out passed), and section 3 closes it: the read must now prove it is the
    whole table.

### One reader, and the first version that read two

The first version, committed but never pushed, read the table on two
readers side by side: the owner route (the Data panel's door) and the site's
own read. It required the two to agree field for field before judging
anything (`readers-disagree`). **Before the push, that requirement was found
to be wrong, and the owner route was taken out of the check:**
- **The two readers do not present values the same way.** The owner route
  reads through `sqlQuery` (`site-db.mjs`: `neon(conn, { fullResults: true
  })`, with the driver's default parsers).
  - **Measured locally** with the locked driver (`@neondatabase/serverless`
    1.1.0), fed a canned answer through its own `fetchFunction`, with nothing
    sent anywhere: NUMERIC `40` and BIGINT `7` came back as the text `"40"`
    and `"7"`; INTEGER and REAL as numbers; DATE and TIMESTAMPTZ as Date
    objects (`"2026-09-02T00:00:00.000Z"` once written as JSON); TEXT as
    text.
  - The site's own read is the Data API (PostgREST). It serves a number as a
    JSON number (the recorded body's `"price":40`), and JSON has no date
    type, so a date is its own text.
  - `canary-rows.mjs` already warned of this for D1 ("the owner route may
    answer a NUMERIC column as a string"). That is why D1 compared the price
    by its decimal value on each reader, and never compared the two readers
    with each other.
- **The builder can declare such columns**: `numeric`, `bigint`, `date` and
  `timestamptz` are among the types it accepts (`site-schema.mjs`,
  `builder/site-table.mjs`). On such a table the first version would have
  stopped every press, a correct setup included.
- **The tests had not shown it**, because the stub gave both readers the
  same rows. That is the trap *a fixture must come from its real producer*:
  the owner route's rows were never produced by its driver.
- **The site's own read is the right single reader**: the digests a press
  names are computed from it (anyone can take it, for free); it is the read
  the job's writes show in (Batch 1's B1); and it is what a visitor sees.
  A setup the Data panel holds but the site does not serve is caught as
  missing or mismatched.

### Validation

- **`test/canary-fixture.test.mjs`, 20 cases**:
  - the box: blank, valid, and 21 malformed forms, each with its own reason;
  - the digest: key and row order ignored, a value's type counted. It is
    pinned to the real recorded body (736 bytes, `a4f1dc30…`): all four rows
    digest to `f93f11a2c1c90b77…` and rows 1–3 to `9abd34f2b2c362eb…`;
  - the rejections: run 77's own setup (target missing), the temporary row
    present with the price not put back (baseline mismatch), a put-back not
    landed, two matching rows, and a read that is not a whole row list (a
    refusal, no answer, a page, an object, an id twice, a text id). A
    target is never met by coercion or by a missing column;
  - the valid controls: the delete test's setup (it names the target's id),
    the put-back check at 40, and a served key order;
  - the evidence keeps the rows the site served, and none from a failed
    read;
  - **the real script, end to end, under an in-process network stub**
    (`test/fixtures/canary-stub.mjs`: every `fetch` and `https.request`
    answered and logged, the addresses `.test` names):
    - run 77's setup exits 1 with no routing call and no paid POST, after
      one site read and no owner-route read;
    - a site read that refuses exits 1 with no routing call, as
      `unreadable`, with no rows kept;
    - a malformed box and a box beside a restore exit 2 with no network
      call at all;
    - the setup as named reads the site once and the owner route never,
      routes once, and its paid POST is the stub's to refuse;
    - with spend `no` it exits 0 with no routing call;
    - a blank box changes nothing: the press routes as before.
- **On the site's real served body** (read free at 18:22 UTC, 2026-09-30:
  the site's own read, 200, 736 bytes, sha256 `2ec299b8…`), with the
  verdict run locally over the same reader the canary uses:
  - four rows, and row 4 is still 42: the put-back has not landed;
  - rows 1–3 still digest to `9abd34f2b2c362eb…`;
  - the put-back box answers `target-missing` (no row 4 at 40), and so does
    the delete test's box (no temporary row). Both are the right refusals
    for today's setup.
- **Three placement guards** in `test/edit-canary.test.mjs`: the box is read
  before the sign-in and refuses a malformed or misplaced box with exit 2;
  the check reads the site's own read (and not the owner route) and is
  judged above the spend switch, the paid half and the routing call, with
  the reading written before its exit; the workflow carries the box and it
  arms nothing.
- **An existing guard caught the first placement.** The check first sat
  between the scenario mode and the spend switch. `canary-ui.test.mjs`
  reads that stretch as the scenario mode's own, and requires it to end on
  the mode's exit, so the full suite failed there. The check moved above the
  modes, which is the same order for every run it can be part of. A box
  beside a mode is refused before the sign-in, so the check never runs
  inside one. The guard is unchanged, and the placement guard here reads the
  check's own bounds.
- **Red check** (the new module, stub and tests over `main`'s script and
  workflow, in a throwaway worktree): exactly the 8 cases that need the
  check fail. Those are the 5 end-to-end cases (run 77's setup, the refused
  read, malformed/misplaced, both valid controls) and the 3 placement
  guards. The blank-box control, all 14 module cases and the 20 existing
  canary cases in `edit-canary.test.mjs` pass (35 in all).
- **Mutation sweep** (`scripts/mutants/canary-fixture.json`, its own
  worktree at `3229272e`, over `test/canary-fixture.test.mjs`,
  `test/edit-canary.test.mjs` and `test/canary-ui.test.mjs`, a green
  baseline): **18 of 18 killed**, both comment-only controls survived, and
  none failed to apply. The worktree was left with no change of its own. The
  mutants:
  - in the module (11): extra keys accepted; the baseline's form unchecked; a
    non-scalar target value accepted; several matches taken as one; the
    target folded into the digest; a baseline mismatch let through; a
    missing column meeting `null`; a value met by its text; keys left
    unsorted; an unreadable site read not a stop; the evidence keeping no
    rows;
  - in the script (6): a malformed box not stopping the run; a box beside a
    restore not refused; a setup not as named not stopping the press; the
    free rehearsal not reading the rows; the owner route read in place of
    the site's own read; a refused site read taken as rows;
  - in the workflow (1): the box not reaching the script.
- **Full suite**, from the main working tree at `3229272e` with these
  records: **`8383 / 8383 / 0 / 0`** locally, which is `main`'s 8,360 plus
  the 20 cases and the 3 guards. **Unit CI** on the pushed head `11bb6a14`
  (these records on top of `3229272e`): run 36758456675, job 110034590530,
  `8383 / 8379 / 0 / 4`, read from the job's own log. The totals match, and
  CI skips the same four it always does. The document-reading tests
  (`brand-rename`, `media-deleted`, `components-doc`) read 32 of 32 on the
  final records.
  - An earlier run of the first version, from a scratch worktree, failed one
    case: `render-sandbox`'s privilege-drop test. That test starts a server as
    `nobody`, and the worktree sat in a directory only root can enter, so the
    server's own file could not be reached (MODULE_NOT_FOUND). The same file
    passes 20 of 20 from the main working tree. The failure came from where
    the worktree was, not from the code.

## 3. The read proven whole (`fc06edde`, after the owner's review of the check)

**The owner's finding.** The check's transport kept no response headers, and
`readRowList` took any 200 list. The owner reproduced a false pass with the
actual transport and verdict: the named baseline and target served, a third
row left out, `Content-Range: 0-1/3`, and the check passed. Served all three
rows, it failed `baseline-mismatch`, as it should. The owner's words: *"Prove
the table read is complete using the existing API's supported
count/pagination contract. An incomplete or unverifiable read must stop
before paid routing. Keep this read-only and scoped to the guard."*

**The contract, measured** (free and read-only, through the Worker, on
fretwork-1's `lessons`, 19:11 UTC):

| asked | status | `Content-Range` | rows |
|---|---|---|---|
| no `Prefer` | 200 | `0-3/*` | 4 |
| `Prefer: count=exact` | 200 | `0-3/4` | 4 |
| `count=exact`, `limit=2` | 206 | `0-1/4` | 2 |
| `count=exact`, a filter matching nothing | 200 | `*/0` | 0 |

The Worker forwards `prefer` and returns the upstream status and
`content-range` (`proxySiteService`), so the guard needed no product change.

**The change.**
- `readWhole` (`scripts/canary-fixture.mjs`) takes the rows only when the
  answer's count is the number of rows it served, with a range from the
  first row to the last: `0-(n-1)/n`, or `*/0` with none. Otherwise it
  stops, before any routing call:
  - `incomplete`: a 206, or a count above the rows served;
  - `completeness-unknown`: no header, a `*` count, a header it does not
    read, or one that does not describe the rows beside it;
  - `unreadable`: not a whole row list, as before.
- The script's read asks `Prefer: count=exact`, keeps the `Content-Range`,
  and is judged by `readWhole`. The verdict carries the read's own reason,
  and `fixture.json` keeps the range.
- **The stale text, corrected**: the box's log line said the rows are "read
  on both readers", and the workflow's comment said the table is read on
  the owner route and the site's read and that "the two must agree". Both
  now describe the one read, whole. The form's description reads *"Refuse
  to route or spend unless one table, read whole as the site serves it, is
  as named: …"*.

**Reproduced, then closed, through the real script** (the stub answers the
count contract as the Data API does; five rows served, as named):

| the site's answer | the previous script (`3229272e`) | now (`fc06edde`) |
|---|---|---|
| part of the table, 200, the count above the rows | never asked for the count; as named; routed, and the paid edit posted | asked; `incomplete`; no routing |
| part of the table, 206 | stopped as `unreadable`, by its status alone | `incomplete` |
| the count not given (`0-4/*`) | as named; routed, and the paid edit posted | `completeness-unknown` |
| no `Content-Range` | as named; routed, and the paid edit posted | `completeness-unknown` |
| the whole table as named (`0-4/5`) | routed | routed (the control) |

### Validation

- **`test/canary-fixture.test.mjs`, 25 cases** (was 20):
  - `readWhole` on 18 answer shapes (3 whole, 15 not): whole, empty, the
    header's spaces, a 206, a count above the
    rows, a `*` count, no header, an empty header, a header it does not
    read (a unit, a decimal, 16 digits), a range not from the first row or
    not to the last, a count below the rows, `0-0/0` with no rows, and
    bodies that are not row lists. Nothing that is not whole hands its rows
    on;
  - the owner's reproduction as a unit case: the named rows served with one
    left out stop as `incomplete` (200 and 206), the whole table with the
    extra row fails `baseline-mismatch`, and the whole five pass;
  - the evidence keeps the range, and no rows from a read that is not
    whole;
  - **through the real script under the stub**: the owner's 200 and the
    API's own 206 stop as `incomplete`; a `*` count and no header stop as
    `completeness-unknown`; the whole table with a row more fails
    `baseline-mismatch`. **Each refusal asserts** exit 1, *"Nothing was
    routed or charged."*, no routing call, no paid edit, a read that asked
    `count=exact`, and that read being the run's last call, so nothing that
    could charge came after it. The whole table as named routes once (the
    control), and a blank box reads nothing.
- **The placement guards** also hold `prefer: "count=exact"`, the kept
  `Content-Range` and `readWhole(served)`, and the log line's own words.
- **Red check** (these tests, module and stub over `3229272e`'s script and
  workflow, in a throwaway worktree): 8 fail and 40 pass. The failures are
  the six end-to-end cases that need the read to ask for the count, and the
  two placement guards; the table above is what that script did.
- **Mutation sweep** (its own worktree at `fc06edde`, over the same three
  test files, a green baseline): **30 of 30 killed**, both comment-only
  controls survived, none failed to apply, and the worktree was left with no
  change of its own. The 12 new mutants: a 206 not a stop; no header taken
  as whole; a `*` count taken as whole; a count above the rows not called
  incomplete; a count below the rows let through; a range not from the
  first row, or not to the last, let through; no rows with a counted range
  let through; the verdict dropping the read's own reason; the evidence
  dropping the range; the read not asking for the count; the answer's
  `Content-Range` not kept. Two earlier ones were re-anchored to the changed
  lines (the owner route read in place of the site's, a refused read taken
  as rows).
- **Full suite**, from the main working tree at `fc06edde` with these
  records: **`8388 / 8388 / 0 / 0`** locally, the 8,383 before plus the 5
  new cases. **Unit CI** on the pushed head `08da9b48` (these records on
  top of `fc06edde`): run 36765527935, job 110058603843, `8388 / 8384 / 0 /
  4`, read from the job's own log. The totals match, and CI skips the same
  four.

## 4. The guard passes review; the £40 still not there (19:40 UTC)

- **The owner passed the whole-table guard's review** (2026-09-30), and
  moved on to the unresolved £40.
- **Read again, free, at 19:40 UTC**, as the guard reads it (`Prefer:
  count=exact`): 200, `Content-Range: 0-3/4`, whole, 736 bytes, sha256
  `2ec299b8…`. Rows 1–3 hold every field of the saved baseline; row 4
  differs only in `price`, 40 → 42; no other row. The four rows digest to
  `2fb9f28608ca8b27…`, not the baseline's `f93f11a2c1c90b77…`.
- **So the £40 baseline is not verified.** As the owner asked, the two
  questions go back to them (what Save displayed, and the price after the
  panel was closed and reopened), and the diagnosis waits for those
  answers. The temporary row's steps and the free rehearsal wait for the
  £40 to read back.
- **Read again, free, at 20:04 UTC**, after run 78, the same way: 200,
  `0-3/4`, whole, the same four rows (row 4 still 42, digest
  `2fb9f28608ca8b27…`). The two questions are asked again.

## 5. Merged and deployed (deploy 2173)

On the owner's word ("commit and merge"), `main` was fast-forwarded
`80ece106` → `8908b59d` at 19:48:47 UTC, after the pre-merge checks (nothing
in flight, unit CI `8388 / 8384 / 0 / 4` on the candidate, no site-build path
touched, no skip-CI marker, the rollback giving main's tree, the image
predicted on both ends). Deploy 2173 was green in 45 s and reused
`e71f7bae88b9ecf1`. **Runtime-confirmed by the owner's free press, run 78**
(19:58 UTC, from `main`): `8908b59d2069` on both readers, the cold
container on `e71f7bae88b9ecf1`, every free check passed, nothing charged.
The `expect_rows` box is now on `main` as well as the branch.
The £40 and the paid deletion acceptance stay open.

**The owner accepted deploy 2173 and run 78** (2026-09-30), with one
clarification: **run 78 did not exercise the fixture guard**. Its
`expect_rows` box was blank (the log's `CANARY_EXPECT_ROWS` is empty, no
`EXPECTED ROWS` line was printed, and the press was on `fold-lane-bakery`,
which has no `lessons` table), and `expect_route` was blank too. It
confirmed the runtime only. The guard has run only under the in-process stub;
its first live run is the free rehearsal, after the £40 and the temporary row
are verified.

## 6. One observed Save (handed over after the 20:13 UTC read)

**The owner's instruction** (2026-09-30): "guide me through one observed Save:
fretwork-1 → Data → lessons → "Hour one-to-one", price 42 → 40. Capture what
Save displays and the value after reopening the panel." Then a whole read
against the baseline, and, if the change did not persist, an investigation
from that observed result.

**Read just before the steps, free, at 20:13 UTC**: 200, `0-3/4`, whole; rows
1–3 every field as the baseline, row 4 differing only in price (42), no other
row.

**What the code does on this path** (read, not run):
- The site card's database button (title "Data") opens the workspace on its
  Data view; the workspace's top tabs are Preview, Code, Data and More. The
  button is lit when the list says the site has a database, which for
  `fretwork-1` comes from `backendState` (`incomplete` counts) since Lane 1c.
- The panel lists the declared tables on the left and reads the chosen one
  through `GET /api/site/fretwork-1/rows/lessons` (newest first). Each row has
  **Edit** and **×** (delete, behind a confirm box).
- **Edit** opens a form above the table with one box per declared column
  that is not managed: `name`, `description`, `price` and `duration` (never
  `id` or `created_at`).
- **Save changes** sends `PATCH /api/site/fretwork-1/rows/lessons/4` with all
  four boxes as text, and the route writes those four columns with one
  `UPDATE … WHERE id=?` (`handleOwnerWrite`, `site-owner.mjs`).
- **On success there is no message**: the form closes and the table is read
  again. **On a refusal** a message shows at the bottom centre for 5 seconds
  (the server's own `error`, or "Couldn't save that."), and the form stays
  open. A dropped connection says "Couldn't save that — check your
  connection."; a 401 brings up the sign-in screen.
- **Every owner data request looks the owner up in Supabase, uncached**
  (`ownerOf`: `site_backends?slug=eq.fretwork-1&select=uid`), after the
  session check. So Supabase's request logs can show whether the panel's
  reads and the Save reached the owner route, and when.

**The owner's report**: awaited.

## 7. The £40 through the owner save path: authorized, blocked at sign-in (20:26–20:27 UTC)

**The owner's authorization** (2026-09-30): "You are authorized to make this
correction yourself. On fretwork-1 → lessons → id 4, "Hour one-to-one",
restore price 42 → 40 using the existing authenticated owner save path used by
the Data panel. Read first. If it is already 40, verify it without writing
again. Change only the price; preserve every other field and row. … This
authorizes this correction only, with no paid model call. If access genuinely
blocks you, report the exact blocker instead of automatically handing the task
back to me."

**Read first, free, at 20:26:19 UTC**: 200, `0-3/4`, whole, 736 bytes, sha256
`2ec299b8…`. Rows 1–3 hold every field of the baseline; row 4 differs only in
`price` (42); no other row (digest `2fb9f28608ca8b27…`). So a write was needed.

**Blocked at sign-in, and nothing was written.**
- The save path is `PATCH /api/site/fretwork-1/rows/lessons/4`. The Worker
  takes its caller from `authUser` (`worker.js`): the request's
  `Authorization: Bearer` token, which Supabase's `/auth/v1/user` must answer
  with the owner's user. The one other identity, a queued job's replay marker
  (`editReplayUser`), is offered to the edit, add-on and rebuild routes only,
  never to the rows route.
- This session holds no session for the building account. Getting one means
  minting it (the canary does that inside GitHub Actions) or reading an
  existing one, and the owner's standing rule is that a session never mints
  or reads an owner credential. The authorization covers the correction, not
  that rule, so nothing was minted or read. The environment's permission
  check also refused a listing of credential-like environment variable
  names, and it was not retried another way.
- **Probe, 20:27:19 UTC**: `PATCH /api/site/fretwork-1/rows/lessons/4` with
  no token and an empty JSON body answered `401 {"error":"sign in
  required"}`. The empty body could have written nothing even past the gate
  (the route answers "nothing to update").
- **No existing mode fits.** The canary's recover-only mode writes through
  the owner route with the canary's own session, but its one row scenario is
  D1's (`loaves` id 6 on `fold-lane-bakery`, `scripts/canary-ui.mjs`).
  Pointing it at this row is a new scenario: a code change for the owner's
  approval.
- No model call, no charge, no write.

**Read again at 20:31:16 UTC**, before the handoff's commit: the same (whole,
`0-3/4`, row 4 still 42, digest `2fb9f28608ca8b27…`).

**What this exercised**: whole reads of the table, and one request refused
at the save route's sign-in check. It did not exercise the save itself, and it
says nothing about the owner's earlier browser attempt.

**Ways forward, the owner's choice**:
- the owner's own Data panel Save, with §6's observation steps (it also
  answers what Save displays);
- a recover-only canary scenario for this row, approved as a small code
  change with tests and review, then a free press: price 40 only where it
  is still 42 (the conditional write);
- the owner's conditional `UPDATE` in the Neon console (the recorded
  fallback).

## 8. Demo sites: no restoration; the deletion re-prepared on the current table (20:53 UTC)

**The £40 through the canary, built and dropped.** After §7 the owner said
"use my account", then "use the canary thing". The canary is the one route
that signs in as the owner (inside GitHub Actions). A recover-only scenario
for this row was built: `b2-price-restore`, the owner route's PATCH, the price
alone, only while it reads 42.
- A first attempt was refused by the environment's permission check
  ("Modify Shared Resources"). After "use the canary thing" it went through.
- Its sweep killed 15 of 15 with both controls surviving, and the full suite
  was `8393 / 8393 / 0 / 0` locally.
- It was then **discarded unpushed**: the owner stopped the restoration
  before it was pressed.

**The owner's rule** (2026-09-30): "Stop treating data restoration as a
prerequisite. These are demo sites; I don't require them restored after each
test. Use whatever state currently exists as the baseline. … Don't force the
price back to £40." And the target: "a normal AI request going through the
real edit route: correct row deleted, unrelated rows unchanged, website
reflecting the deletion, and billing correct", the next paid run subject to
the owner's approval and a credit estimate. So B2's recovery is closed by
that rule, not by a write: row 4 stays at 42.

**The current table, read whole at 20:53:26 UTC** (the site's own read,
`Prefer: count=exact`): 200, `0-3/4`, 736 bytes, sha256 `2ec299b8…`:
| id | name | price | duration |
|---|---|---|---|
| 1 | First lesson | 0 | 45 minutes |
| 2 | Group of three | 18 | 45 minutes |
| 3 | One-to-one | 30 | 45 minutes |
| 4 | Hour one-to-one | 42 | 60 minutes |

**Where a visitor sees them**: `/` and `/prices` both read the table live
(`/api/db/fretwork-1/data/lessons?select=*&order=price.asc`) and show all four
names; `/gear` shows none. Every page is at `kk6qsh`. Before-pictures of `/`
and `/prices` are kept for the comparison afterwards.

**The disposable row: an existing one, id 2, "Group of three".**
- I cannot create a row myself. The Data panel's save needs the owner's
  session, and a visitor cannot write to `lessons`, a display table.
- The owner's rule makes an existing demo row fair game.
- It is the one name no other name contains. "Hour one-to-one" contains
  "One-to-one", which would test the picker's reading of two similar names
  rather than the deletion.

**The row check's box**, judged by the canary's own functions on that read:
it parses, and the verdict is `as-named`: "4 rows; the target is id 2, and
the other 3 digest to 47c5b2217d6d6453". The other three rows' full digest is
`47c5b2217d6d6453e647bf65deccb0b6b63b805e9ee8d98e23d200e1fbd53a5e`. After a
correct deletion the remaining rows must still digest to it.

`{"table":"lessons","baseline":"47c5b2217d6d6453","target":{"id":2,"name":"Group of three","description":"Share a 45-minute lesson with two other beginners. Eighteen pounds each.","price":18,"duration":"45 minutes","created_at":"2026-09-02 16:57:02"}}`

**The request** (75 characters, 75 bytes, sha256
`2575a60b5dd3fc29…`), in run 77's form:

> We don't do the Group of three any more, please take it off the price list.

The presses, the pass and the estimate are in the checklist's *Lane 4's
delete*, "Re-prepared on the current table".

