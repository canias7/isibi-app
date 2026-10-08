# The third Build correction batch: recovery and billing closed together (2026-10-08)

Codex reviewed `3308d51d`, confirmed green CI, and independently passed the
attachment-ID and gateway-binding corrections. Both are kept unchanged.
Using the real modules and the Worker's own functions under controlled
dependencies, they reproduced four gaps offline. This round reproduces each
the same way in `test/build-recovery-billing.test.mjs` and closes them.
Nothing was merged, deployed or built; there was no paid call, and no SQL
was applied.

## The four gaps, as reproduced

1. **Staging read as publication.** `stageBuild` writes a version's manifest
   before activation, and `listBuilds` lists it. `lostBuildVerdict` took any
   manifest naming the job as proof: a version staged and never activated,
   with pointer `null` and recovery holding the fence, answered
   `published / version-names-job`.
2. **A failure erasing a publish.** `markPublishFailed` read the fence, and
   then later overwrote it unconditionally. A success written between the
   read and the write was erased.
3. **Billing racing recovery.**
   - `buildLedger`'s state read was not in the debit's transaction.
   - A valid bearer went straight through `credit_debit` and never reached
     `build_debit`.
   - The proposed SQL's job-row read had no lock.
   - So applying the SQL alone did not close the race. **The previous
     handoff said it did; that was wrong.**
4. **The scan starving rows.**
   - `reconcileLostBuilds` read the same oldest 20 fresh rows every tick,
     settled ones included, and the pending listing had no pagination.
   - Codex ran three ticks with 21 fresh lost jobs, the first 20 settled:
     job 21 was never processed or registered as pending.
   - **The previous handoff claimed unresolved recovery stayed findable;
     past 20 rows it did not.**

## What changed

### A. Publication needs a durable record of a successful activation

- **One thing proves publication**: the fence's `published` version.
  - It is written only after an activation answered success, and only
    conditionally (§B).
  - It survives a later edit moving the pointer, and version pruning.
- **A manifest naming the job is staging evidence.** It is written when the
  version is staged, before any activation, so it never proves publication.
- **The pointer naming the job means "under way or done".** It is written
  at the start of an activation, which can still fail and roll back, or
  crash before its end is recorded. So it gives **unknown**.
- `lostBuildVerdict` (`builder/build-lease.mjs`) answers:

| Outcome | When |
|---|---|
| published | the activation record |
| not-published | no address; or a fenced job whose fence recovery holds, or whose publish recorded a failure, with the pointer not on the job |
| unknown | a read failed; the pointer on the job without a record (a crash between steps, or a rollback that did not land); a publish holding the fence with no outcome (after later edits and pruning too); or, for a job from before the fence, a manifest naming it or a version naming no job |

### B. The fence moves one way, conditionally

- `moveFence` does a read, a decision on what was read, and a write
  conditional on that read's etag (`onlyIf.etagMatches`). A refused write
  reads again and decides again. An unreadable fence is left alone.
- The transitions only move forward:
  - publish → publish + failed → publish + published;
  - publish → publish + published, which is terminal;
  - recovery is terminal, and no outcome write ever takes it.
- So a failure that read before a success cannot erase it, and a second
  delivery cannot replace the first recorded version.
- The test bucket (`test/fixtures/build-route.mjs`) now behaves as R2 does:
  per-write etags, `etagMatches`, and a `beforePut` hook that runs another
  writer between a read and a write.

### C. One transactional billing path for a queued build

- **`buildLedger.debit`.** A build with a job row, the service key and the
  mint key asks `build_debit` FIRST, whatever its token.
  - Only an absent function (404, the SQL not applied) or a build with no
    row (`no-job`) falls back to the reviewed path: state read, bearer, then
    `build_debit` on a refused bearer.
  - A terminal refusal is known (`jobState`, nothing charged).
  - A lost or malformed answer is unanswered and never charged a second way.
  - An answer without the ledger's `ok` is never read as "nothing taken".
- **`supabase/proposed/build_debit.sql`** (unapplied) now reads the job row
  `FOR UPDATE` before checking its state, and debits in the same
  transaction.
  - The sweep's terminal write takes the same row lock, and the terminal
    states are never left in any applied function.
  - So either the debit commits first, and recovery (acting only on a row
    already lost) finds it on the ledger when it reverses by ref, or the
    terminal write commits first and the debit is refused.
  - The file says that it closes the race only together with the Worker
    code.
- **Duplicate delivery** still answers `repeat`, and an ambiguous answer is
  still reconciled by ref (`debitPagesReconciled`).

### D. The scan makes resumable progress

- **Fresh rows.** A keyset cursor (`recovery/cursor.json`: the last row's
  `updated_at` and id) walks the lost build rows forward, 20 a tick
  (PostgREST `or=(updated_at.gt."…",and(updated_at.eq."…",id.gt."…"))`,
  ordered by both).
  - Every unsettled row is registered as pending before it is decided.
  - The cursor moves past a row only once it is settled or registered.
  - A failed registration stops the page there, and the next tick starts
    from that row.
  - A failed read moves nothing, so an outage of any length loses no row.
    The one-day window is only where a first run starts.
- **Pending.** The listing is paged 50 a tick with R2's own cursor
  (`recovery/pending-cursor.json`), which wraps when the listing ends.
  - Every entry is retried until it settles: persistent unknowns, partial
    refunds.
  - A cursor R2 refuses is dropped and the listing starts over.

### The limits inventory

`docs/investigations/build-limits-2026-10-08.md` keeps the inventory for
individual review. P3–P5 are revised to keep the customer's requirements
inside the real constraints, instead of truncating and warning afterwards.
This covers the brief, clarification answers, sections, actions, image
requests, facts and linked pages. Nothing is implemented. Build keeps 1 page
and 15 components.

## Tests

- **`test/build-recovery-billing.test.mjs`**: 18 cases.
  - **A**: a real staged version; failed activation and rollback; a crash
    between steps; later edits and pruning; a real activation recorded and
    then edited over and pruned (a control).
  - **B**: the two interleavings driven by the hook (failure read → success
    write → failure write, and the reverse), recovery claiming between a
    read and a write, an unreadable fence, and every delivery order.
  - **C**: a valid bearer; a row turning terminal between the read and the
    debit; repeat; a lost answer; a malformed answer; absent, and no row.
    Plus the SQL's lock order.
  - **D**: 21 fresh rows with 20 settled; registration before decision; an
    interrupted page; an outage of more than a day; 60 pending entries with
    persistent unknowns; a partial refund finished later.
- **Updated** in `test/build-audit-batch.test.mjs`:
  - the pins that changed on purpose (`build_debit` first; publication by
    record);
  - a test bug, an async IIFE that made `b.get` a Promise, which the old
    scan's catch-all had hidden;
  - the stub, which now honours the keyset filter.
- **`test/fixtures/request-flow.mjs` and `test/handover-resume.test.mjs`**
  answer `build_debit` 404, as production does today. Their generic `[]` or
  `{ok:false}` answer had been read as a real refusal.
- **Measured numbers** (red/green, sweep, suite, CI) are in the owner-notes
  handoff, stamped after each run.

## Remaining gaps

- **The SQL is unapplied.** Until it is, a queued build keeps the fallback,
  whose state read is not transactional: the race remains in production
  until the owner applies `build_debit.sql`.
- **A crash between a successful activation and its record** stays unknown,
  listed and retried, until review. There is no live-script probe for build
  recovery.
- **Pre-fence jobs** with a staged manifest or an unattributed version stay
  unknown.
- **The first run** starts its cursor one day back. Lost rows older than
  that, from before this code, are not picked up.
- **Fence and cursor objects** are never deleted.
- `credit_reverse`'s gateway binding is still a prefix.
- A real model's use of attachment ids is unmeasured.
