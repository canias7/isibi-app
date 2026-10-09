# Parallel tasks, round 2: one owner per preparation, and preparation for every step that can have it (2026-10-09)

> **On the branch `claude/help-needed-ehlwlj`, not merged, deployed or
> built.** No paid call, no paid retest, no SQL. **Evidence: supplied model
> answers and a stand-in image service only**, through the real Worker
> routes, the real request driver and the real queue consumer. No real
> model and no live site has been asked any of these messages.

The owner's order (2026-10-09) had two parts:
- fix the duplicate preparation Codex reproduced on `464c6a3c`;
- extend isolated preparation and result reuse beyond text, menu and
  picture, with the existing driver and jobs, coordinated publication, and
  honest reporting of what overlaps.

## 1. One owner per preparation (`3be40e6a`)

### What Codex showed

Codex used the real request-flow fixture and queue consumer:
- they took the TikTok-plus-photo request's `request-prep` message and
  delivered it twice at once, holding the preparation's routing call;
- both deliveries passed the consumer's read-only "attempting" check before
  either wrote anything;
- the one preparation bought two photographs.

The earlier twice-delivery case (P6) delivered one message after the other,
so the two never overlapped.

### The fix

- **Taken before any call.** A consumer moves the claim from `attempting`
  to `running`, with its own owner token, in one write of the request record
  on its etag (`takePrep`). Of two deliveries read at the same moment,
  exactly one write lands. The other reads again, finds the claim taken, and
  makes no call.
- **Kept only by the owner.** `notePrepared` accepts an outcome only for a
  `running` attempt with the same `seq` and the same owner. A consumer that
  lost the claim, or a late one whose attempt was since taken again, keeps
  nothing and never replaces a newer result.
- **Recorded as it goes.** Every recorded call and every purchase note is
  written to the attempt's own key (`prepKey`, its `seq`) as it happens.
  An attempt that dies therefore leaves a record of what it did.
- **A purchase is noted before it is made**, as `buying`, then `bought`
  with its address or `none`. Before each purchase the consumer checks that
  it still owns the attempt and is inside its own time (`ownsPrep`).
- **Expiry.** An attempt is taken again after `PREP_FRESH_MS` (10 minutes):
  - a running attempt is measured from when it was taken;
  - a sent-but-untaken attempt from when it was sent.
  The new attempt names the one before (`prev`) and:
  - reuses its recorded answers for byte-identical requests;
  - reuses its bought pictures for the same descriptions, hidden from the
    library listing the attempt is shown (as the job already hides them);
  - never repeats a purchase whose note still says `buying`, because that
    purchase's outcome is unknown. The attempt ends `uncertain`, with no
    call at all.
- **A late purchase is reused, not repeated.** For an `uncertain` attempt,
  the part's own job is staged with whatever the earlier attempt did buy,
  read when the job starts. So a picture that landed after its owner lost
  the attempt is used, not bought again.

### Tests (`test/parallel-prep-ownership.test.mjs`, through the real consumer)

- **OWN 1, Codex's reproduction:** the same message delivered twice at once,
  with routing held until both deliveries are inside. Result: one routing
  call, one picture call, one photograph; one charge and one publish per
  job.
- **OWN 2, the owner dies inside its first call:**
  - inside its time the attempt is not taken again;
  - after its time the sweep takes it again, naming the first;
  - the work is done once.
- **OWN 3, the owner dies right after a bought and noted photograph:** the
  next attempt makes no routing call, no picture call and no purchase.
- **OWN 4, the owner dies inside the purchase:**
  - the next attempt ends `uncertain`, with no call and no purchase;
  - the part's own job, finding no picture landed, then makes one purchase.
  That is two purchases from the image service in total (ours), and one
  charge to the customer.
- **OWN 5, a late owner:**
  - the first attempt is held inside its purchase past its time, and the
    next attempt ends `uncertain`;
  - the first then lands the photograph; its result never replaces the
    newer attempt;
  - the part's job reuses that photograph, so there is one purchase in
    total.
- **Unit cases** (`test/parallel-plan.test.mjs`): the claim, a second
  taker, another attempt's answer, expiry, `prev`, and a refused late answer.
- **Red check:** all five OWN cases fail on `464c6a3c`.

## 2. Preparation for the remaining steps (`2c3cd671`)

### What a preparation now runs, and where it stops

A step is prepared up to its first write, never past it.

| Path | Prepared work | Stops before |
|---|---|---|
| Edit: text | the text call | the publish (unchanged) |
| Edit: menu | the menu call | the publish (unchanged) |
| Edit: picture | the picture call and the purchase (with notes, §1) | the publish (unchanged) |
| **Edit: look** | the lane picker and every lane | the look is stored (so no rollback path runs either) |
| **Edit: page** | the tweak, or the page writer's rewrite (now recorded and replayed, `jobCall`) | the publish; never falls through to a second rewrite |
| **Edit: data** | the change chosen | any row is touched (the step's own `before` hook) |
| **Edit: rules** | the rule chosen | any grant, policy or schema write; a blank database link is not healed by a preparation |
| **Add-on** | the picker, the designers, the seed net, and for an addition with no database the page writer; a list entry's choice | a database is made, any charge, any stored answer, any trace |
| Edit: logo | — (no model call) | no parallel work |
| Build (first build) | — | existing design-graph concurrency only (§4) |

### When it is prepared

The plan says what each step reads (`stepInputs`). A step is prepared only
when no earlier, unfinished task in the write order writes any of that:
- **look:** the theme and the pages;
- **page:** every page (its writer is shown them all);
- **data and rules:** the tables;
- **an addition:** the page list, the theme, the menu, the pages and the
  pictures. A stored row it does not read. A table it adds is waited for by
  creation; a table changed beside it is caught by the exact-request check.
- **A picture placed counts as a page write.**
- **A table the router names** stands in for a data or rules step's "some
  table". Two lists can therefore be worked on side by side, and the same
  list is serialized.

### Revalidation

The job's transport is unchanged. A prepared answer is used only for a
request that is byte for byte the one prepared, so anything that changed
what a step reads makes it ask again against the site as it now is. One
case shows this for a page rewrite. The one-page writer is shown only its
own page, so a change elsewhere does not invalidate it, and the publish
keeps that other change.

### Tests (`test/parallel-prep-paths.test.mjs`, through the real driver, consumer and routes)

Each case is two tasks in one message. The first task's job is held inside
its own work: a photograph's purchase, or a stored row's change call.

**What every case shows:**
- the other task's substantive model call is made while that hold is open
  (a gate only that call opens);
- its job then asks none of it again;
- nothing of it is written before its job;
- each job is charged at most once.

**The cases:**
- **look:** the description lane; the stored look is unchanged until the
  job.
- **page:** the page writer's rewrite of `/visit`; the page is unchanged
  until the job.
- **add-on page:** the picker, the designer and the page writer; the page is
  absent until the job.
- **add-on row:** an entry for `loaves` while a row of another list is
  changed. Both changes are kept, the entry is written once, and nothing is
  written before the job.
- **data:** a price; the row is unchanged until the job.
- **rules:** a table's write rule. Nothing is granted before the job, and
  then the job's DDL and stored schema carry the chosen rule.
- **REVALIDATED:** the Visit page changes between the preparation and the
  job. The page writer is asked again, and the change made in between is
  kept.

**P7 now expects** the addition's step to be held back beside a change to a
page it reads. Its calls are still made once, by its own job.

## 3. Progress from what actually happened (`c06977c7`)

The model-written progress lines are told each other task of the request.
A task being prepared used to be told as "in progress". It is now told as
what really happened:
- **while preparing:** "being worked out alongside this one; nothing of it
  is on the site yet";
- **once ready:** "worked out and waiting its turn to go on the site; not on
  the site yet".

The card already said "Working on it alongside" and "Ready, applying next".
No line can call a prepared task done.

## 4. Build: what is existing and what is new

- **Existing, unchanged:** a first Build's design graph runs its agents
  concurrently by their `needs` (`builder/design-graph.mjs`). P8 covers it.
  It is **not** new work, and it passes on the commit before the first
  parallel batch.
- **Not done:** general task orchestration inside a Build (a message that
  mixes a build with edits, or build tasks with their own dependencies
  beyond the design graph). A first Build stays one job, with its 1 page and
  15 components unchanged.

## 5. Cost

- **The same calls are billed once.** Preparation never charges, and the job
  bills recorded usage through its own reserve.
- **New in this round:**
  - an expired attempt reuses the calls and pictures of the one before;
  - an `uncertain` purchase is not repeated by preparation.
  If that purchase never lands, the task's job buys one: two purchases from
  the image service (ours), one charge to the customer.
- **Wasted preparation** (a request that changed before the job) is ours.
  The input rules keep it rare, and they now cover the pages a page writer
  reads and the pictures an addition reads.

## 6. Results

- **Commits:**
  - `3be40e6a` ownership;
  - `2c3cd671` the remaining steps;
  - `c06977c7` progress wording and two re-anchored guards;
  - `7bd4e3eb` the strict no-site-write check, pictures feeding pages, and
    the purchase notes' `none` (from the sweep);
  - and the records.
- **Red check:** RED_CHECK.
- **Sweep:** SWEEP.
- **Full suite:** SUITE.
- **Required CI:** CI.

## 7. Mocked versus live

- **Mocked:** every model answer, the image service, Supabase's RPCs, the
  queue, the site database (`rows-db.mjs`).
- **Not shown live:**
  - real overlap timings;
  - how often prepared answers are reused;
  - whether real models name targets precise enough for overlap;
  - a real duplicate delivery on Cloudflare Queues.

## 8. Remaining gaps

- **Writes stay one at a time per site.** This is the database's
  `site_busy`; it was not required for model work to overlap, and it is not
  changed.
- **An add-on that needs a new database** is prepared only up to its
  design. Its page writer runs in its job after provisioning.
- **Logo:** no model work to prepare.
- **Build:** no general orchestration beyond the existing design graph.
- **An `uncertain` purchase that never lands is bought again by the task's
  job** (our cost). There is no provider-side idempotency to check it
  against.
- **The input rules are a heuristic** for avoiding wasted preparation;
  correctness rests on the exact-request check. They are conservative: an
  addition is never prepared beside a task that changes pages or pictures.
- **No real-model or live run.** Nothing is merged, deployed or built.
