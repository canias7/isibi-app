# 2026-09-30 — Test 9: a follow-up after a failure, in the same chat tab

Prepared on the owner's word after runs 79 and 80 were closed. Built on the
branch as the canary's UI scenario `9-follow-up`. **Both of the owner's
presses passed**: the free rehearsal as run 81, and the paid run as run 82,
which met every pass item for 4 credits (section 7). **Closed by the owner**
the same day (section 8). The plan, the pass list and the presses are in the
checklist's *Test 9*.

## 1. What was asked

The owner, in a message that arrived cut off after the third item:

> Next, prepare one bounded test of a follow-up after failure in the same
> chat tab:
> 1. A request produces a genuine, visible edit failure.
> 2. Without reloading, a normal second request succeeds.
> 3. Verify the second message submits correctly, its intended change
>    happens,

The checks after "its intended change happens" were filled in from the pass
lists the owner set for the deletion (runs 79 and 80) and for D1, and are
flagged for the owner: the first failure changed nothing and its edit charge
was refunded; unrelated rows are unchanged; the website reflects the change;
billing is correct; no reload happened.

## 2. The design

- **The fixture** is `fretwork-1`'s `lessons` as it stands (the demo-site
  rule): three rows, read whole at 21:31:30 UTC, `0-2/3`, 541 bytes, sha256
  `f2396dcb…`, the bytes run 80 left.
- **The failure** is a lesson the site does not have, taken off: *"We've
  stopped running the Weekend workshop, please take it off the price
  list."* The data step matches nothing (`no-match`), the app draws a
  warning, and the job's reserve is refunded (run 77's path). A deletion of
  a row that does not exist cannot add or change one.
- **The follow-up** is *"Please change the Hour one-to-one's price to
  £45."*: `lessons` id 4, 42 → 45, kept.
- **Only the UI mode** sends a second message from the same tab, so the test
  is a UI scenario. The API mode posts one edit.

Checked in the code before building:
- a failed job's stored reply is served only once `edit_refund` has set the
  job `failed` and `refunded` together (`edit_finalize` with `p_ok` false
  stores the reply and leaves the state alone), so the page never reads the
  failure before its refund, and its cost reads 0 (`servedEditReply`,
  `ledgerEditCost`);
- the app draws a refusal as `'⚠️ ' + e.msg` plus the money sentence
  (`editAnswer`, `public/chat.js`), through `linkify`, which escapes HTML
  and links addresses and leaves the words as they are;
- on a blank-link site the owner rows route opens the database through
  `ownerSiteConn` (Lane 1c), so both readers answer on `fretwork-1`;
- both pages draw each lesson as `li > span` for its price, read live as a
  visitor (reads only), and a digit follows the name on each line.

## 3. What changed (scripts, the workflow's text, tests; no product code)

- **`scripts/canary-ui.mjs`**:
  - the scenario `9-follow-up`, its row (`FOLLOW_ROW`, `restore: false`,
    `/prices` and `/`) and the recorded table;
  - `failureVerdict`: a message that must fail is judged on its stored
    reply (the named failure, no row named, edit cost 0) and on the screen
    (a reply that is the warning carrying the stored sentence);
  - `dependencyVerdict` takes `needs.failed`: the follow-up is sent only
    after that failure, and only once the table read after it is the
    baseline;
  - `moneyVerdict` accepts a `refunded` job whose ledger nets to nothing,
    and `refundedVerdict` names a failed message's refund;
  - `sameTab`, with `markTabInPage` and `tabMarkInPage`: the tab is marked
    once the workspace opens, each reply is read in it, and a later message
    is sent only from it;
  - `runUi`: a row the run keeps is never written (its PATCH is swapped for
    a counted refusal, and no probe or recovery is asked); every page in
    `shown.also` is read before and after; after a failing message the table
    is read on both readers;
  - the session plant also marks the app's first-run greeting as seen
    (`WELCOME_SEEN_KEY`; found by the local proof, section 5).
- **`scripts/canary-rows.mjs`**: `shownLead` (a line found by its whole
  start), used by `shownVerdict`; `untouchedVerdict` (field for field, no row
  added or gone, a visitor's read byte for byte, cannot-tell never
  unchanged); the row account says when a row is kept.
- **`scripts/edit-canary.mjs`**: the follow-up's checks (the failure, the
  table after it, the tab, message 2's request, reply and stored reply, the
  change on both readers and both pages); each message's reply read in the
  opened tab (every UI run); a kept row's no-write check in place of the
  conditional-write probe; "each message filed exactly one job"; the failed
  message's refund read with the money.
- **`.github/workflows/edit-canary.yml`**: the scenario box names
  `9-follow-up` (no apostrophe inside the quoted text).

## 4. Validation

- **Tests**: 15 new cases and one changed (`test/canary-ui.test.mjs` 13
  new, `test/canary-rows.test.mjs` 2 new; the money case now expects a
  refunded job to close). The stand-in page gained the tab mark, a slug, a
  final status, the screen's own text, and a page that reloads itself. The
  driver is run end to end: the success path; a first message that
  succeeds, fails another way, is not shown or moves the table (message 2
  never typed); a reload after the failure (message 2 not sent); a reply
  that never comes (nothing written); the rehearsal; four wrong starts; and
  the no-write guard reached on purpose.
- **Red check** (the new tests over `8b8c07a0`'s scripts, with the new
  names shimmed to the old behaviour so the files load): exactly the 16 new
  or changed cases fail, and the 90 others pass.
- **Sweep** (its own worktree, byte-identical to the final tree, a green
  baseline of 106 of 106): 45 of 45 mutants killed; 3 comment-only
  controls survived. The first pass had one survivor, "an unreadable read
  is unchanged": the cases asserted the reason and not the refusal. They now
  assert both, and the full sweep was run again on the final code.
- **Full suite**: `8403 / 8403 / 0 / 0` locally (8,388 before, plus the 15
  new cases), run from the working tree after the sweep had finished.
- **Unit CI** on `04331c8c`: run 36782393786, `8403 / 8399 / 0 / 4` (CI
  skips four), the same total.

## 5. The local proof against the real app's code, and what it found

The UI mode's own kind of proof, as before its first press (2026-09-26):
the live gofarther.dev files and the live `fretwork-1` site's files,
fetched over TLS-verified Node fetch and served into a real Chromium, with
every call to the app's API, to Supabase's auth and to the site's data
answered from a local copy of the table. No live write, no model call, a
fake session and never an owner credential (scratch, not committed). It
proves the driver and the app's own page code on this flow, not the live
platform's answers.

**It found a blocker before any press.** The first-run welcome modal
(`maybeShowWelcome`, `public/chat.js`) covers the page on a fresh browser
whenever an unpaid balance is 1 to 20 and the browser stores no site. The
canary's context is always fresh; every UI run before had more than 20. At
today's 10 the modal intercepted the site card's click, so the free
rehearsal would have failed at opening the card.
- **The fix** (`scripts/canary-ui.mjs`): the init script that plants the
  session also marks the greeting seen (`WELCOME_SEEN_KEY`,
  `zephyr_welcome_v1`), for the app's origin only and never over a value the
  page holds, as a returning owner's browser holds it. No edit passes
  through the modal.
- **Its guard** runs the init script in both origins: the site's origin gets
  nothing, the key is the app's own `WELCOME_KEY` (read from `chat.js`), a
  held value is kept, and the app still gates the modal on that key.
- **Swept again**, with four new mutants (the mark dropped, the mark
  overwriting, the plant in every origin, another key): 49 of 49 killed on
  the final code, the 3 comment-only controls surviving.
- **The modal itself** (it greets a returning owner on a new browser, and
  still speaks of the deleted media side) is a backlog item, not changed.

**Then all four paths ran through the real page code:**
- **the rehearsal**: signed in, the card opened, both pages and the table
  read, message 1 typed, nothing sent;
- **the flow as designed**: the app drew *"⚠️ I couldn't match that to
  anything the site stores — say which list it's in and I'll have another go.
  This edit cost you nothing. Reading your message cost 2 credits."*; the
  composer came back usable; the table was the baseline; message 2 went from
  the same tab; the app composed exactly *"✅ Updated one entry in
  lessons."*; both pages showed £45 with every other line as before; and the
  money closed (a reserve and its refund, then one reserve);
- **message 1 succeeding after all** (a row taken off): message 2 was never
  typed, and the change was reported, not put back;
- **the page reloading itself** right after message 1's reply: that reply
  was flagged as read in another document, and message 2 was not sent.
- **Full suite, after the fix**: `8403 / 8403 / 0 / 0` locally (the guard
  grew inside an existing case, so the count is unchanged). Unit CI on
  `e6b659a1`: run 36783584417, `8403 / 8399 / 0 / 4`, the same total.

## 6. Run 81: the free rehearsal passed (22:14–22:15 UTC)

Edit canary run 81 (36784382993, from the branch at `bc313e9b`; evidence
artifact 11129406214), spend `no`, scenario `9-follow-up`, site
`fretwork-1`:
- preflight `8908b59d2069` on both readers, a cold container
  `e71f7bae88b9ecf1`, queued jobs and the runner on; every free check
  passed (its own zero-cost probe jobs settled at cost 0); balance 10;
- the app opened signed in and the card opened its workspace, with no
  modal in the way at a balance of 10; the tab was marked; no console or
  page error;
- `lessons` id 4 read 42 on both readers, three rows, the visitor's 541
  bytes equal to the recorded table; `/prices` and `/` both showed £42;
- no conditional write, no recovery plan, no PATCH, and no POST from the
  page; message 1 typed and not sent; balance 10 → 10.

## 7. Run 82: the paid run met every pass item (22:21–22:23 UTC, 4 credits)

Edit canary run 82 (36785026124, job 110124270397, from the branch at
`709f8d9b`; evidence artifact 11128809989), spend `yes`, scenario
`9-follow-up`, site `fretwork-1`, with the deploy and image boxes filled.
- **Preflight**: `8908b59d2069` on both readers, a cold container
  `e71f7bae88b9ecf1`, and every free check passed. Its probe jobs
  (`a2e7a1f4…` on `fretwork-1`, and `44429beb…` on `washhouse-3`) settled
  `failed` at cost 0, billing `none`, with no ledger row. The balance was
  10.
- **Before**: id 4 was the Hour one-to-one at 42 on both readers, three
  rows, equal to the recorded table. Both pages showed £42.
- **Message 1** (the Weekend workshop): routed `data` (2), one edit, job
  `5cc0cc60…`.
  - The data step matched nothing: the stored reply is 422 `no-match`,
    naming no row.
  - Its reserve of 1 (ledger row 346) was refunded (row 347), and the job
    is `failed` and `refunded`.
  - The app drew the warning with its money sentence. The composer came
    back.
  - The table was the baseline on both readers, byte for byte.
- **Message 2** (the Hour one-to-one to £45), sent from the same tab: its
  mark and time origin at Send were the ones taken when the workspace
  opened, and both replies were read there.
  - It was routed `data` (1), one edit, job `c608d15d…`.
  - The stored reply names exactly `lessons` id 4, `price`, and the app
    composed *"✅ Updated one entry in lessons."*
  - Exactly id 4's price changed, 42 → 45, on both readers. Ids 1 and 3
    are unchanged in every field.
  - `/prices` and `/` show £45 and every other line as before. Nothing was
    published: every page is still at `kk6qsh`, and the stored source is
    byte-identical.
- **Money**: 10 → 6, routing 2 and 1 plus message 2's edit 1 (ledger row
  348, `finalized`). Message 1's reserve and refund net to nothing. No job
  is open.
- **The browser**: one console line, for message 1's poll answering 422 (the
  failure's own status). No page error. Four POSTs: route, edit, route,
  edit.
- **Read again independently** (22:27–22:28 UTC, free):
  - the site's read, whole (`0-2/3`, 541 bytes, `30f8ed88…`), differs from
    the 21:31 read only in id 4's price;
  - both pages in a headless browser show £0, £30 and £45, at `kk6qsh`;
  - Supabase: balance 6, last ledger row 348, both jobs as above, and no
    job open. The terminal states are `done`, `failed`, `cancelled` and
    `lost`, so two refunded `lost` jobs from 2026-09-01 and 09-02 are closed.
- Nothing was put back (the demo-site rule): the price stays at £45.

## 8. Closed by the owner (2026-09-30)

> Run 82 passes review. Close Test 9 for the demonstrated no-match failure
> followed by a successful edit in the same tab. The additional data,
> website, refund, billing, and no-reload checks are accepted. Keep the
> demo data unchanged and don't repeat this test.

The checks filled in after the owner's third item (section 1) are accepted.
The Hour one-to-one stays at £45, and there is no rerun.

## 9. What it will not show

A follow-up after other failures (a hop, an escalation, a failure with no
job); one that leans on the conversation (message 2 names its own row);
other sites; how often.
