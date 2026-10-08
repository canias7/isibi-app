# The fourth Build correction batch: recovery through the real job lifecycle (2026-10-08)

Codex reviewed `41731e86` and, offline, passed the previous four
reproductions: staging versus publication, concurrent outcome writes, queued
billing through `build_debit`, and recovery pagination (including equal
timestamps, 60 pending entries and a multi-day outage). Those corrections are
kept unchanged.

They found two connected defects by running the actual job lifecycle. This
batch fixes both together and tests them through that same lifecycle.
Nothing was merged, deployed or built; there was no paid call, and no SQL was
applied.

## 1. The protocol was read from an envelope production deletes

**What happened.** `runQueuedSiteBuild` reads the job envelope
(`jobs/<id>.json`, which holds the customer's session), then deletes it
before claiming the job. Later, `reconcileLostBuilds` read `fenced` from that
same, now deleted, envelope.

**What Codex showed.** Codex ran the real consumer's read/delete with the
real `packJob`/`readJob`, then recovery over a staged-only version:
- the outcome was `unknown / staged-unconfirmed`, with nothing refunded;
- keeping a valid envelope with `fenced: true` settled the same case as
  `not-published`.

The earlier tests had written the envelope straight into the bucket and
never consumed it — exactly the fixture shape the review warned against.

**What changed.**
- **A protocol record of its own**, `jobs/<id>.meta.json`
  (`builder/build-job.mjs`: `jobMetaKey`, `packJobMeta`, `readJobMeta`).
  - It holds `{ v: 1, fenced }` and no credential.
  - It is written create-only, so a later writer cannot change it.
- **Where it is written**:
  - beside the envelope when the producer files a build (`keepJobMeta`
    after the `jobKey` put);
  - when a request's rewrite job is stored;
  - again, if absent, by the consumer **before** it deletes the envelope,
    from that envelope's own flag.
- **The container runs the same `runQueuedSiteBuild`** (`takeOver`), so one
  boundary covers the Worker and the container. A resume or refire reuses
  the job id, so the record already written serves it.
- **Recovery reads the record first** (`jobFenced`). It falls back to the
  envelope only while that is still there (never consumed). With neither, it
  answers **not known**, which the verdict keeps unknown.
- **Nothing is guessed.**
  - An older envelope with no flag records `fenced: false`.
  - A record that could not be written is absent.
  - Both stay unknown, never fenced.
  - The credential-bearing envelope is not kept to preserve one flag.

## 2. The settled marker was written before the customer's answer

**What happened.** The marker said `settled: true` before `resultKey(id)`
was written. Codex made that result write fail after the refund. The next
tick saw the settled marker, deleted the pending entry, and never repaired
the missing answer.

**What changed.** Money and delivery are recorded apart.

- **The settlement record** (`jobs/<id>.lost.json`) holds:
  - `settled`: the refund is complete, or nothing was owed, and it is never
    redone;
  - `delivered`: the answer is stored;
  - with outcome, why, version, slug, returned and short — enough to
    rebuild the answer from the record alone.
- **The order, and what each failure leaves**:

| Step | If it fails |
|---|---|
| reverse | idempotent; a short refund keeps the row pending |
| record settlement | the row stays pending; the next pass reverses again by (ref, reason), which gives nothing new, and records |
| store the answer (`deliverLostAnswer`) | the row stays pending; every tick rebuilds the answer from the record and stores it again |
| record delivery | the row stays pending; the next tick stores the same answer and records |
| delete the pending entry | the next tick finds the row settled and delivered, deletes the entry, and writes nothing |

- **The refunded amount is read as totals from the ledger's own answers**
  (`refundLostBuild`: per ref, `refunded + already`). After a restart, the
  repeated reversal answers `refunded: 0` and gives the earlier amount in
  `already`, so the customer's sentence states the true amount, not zero.
- **A newer authoritative answer is left alone.** If the result slot holds
  the build's own answer (not a recovery answer), delivery counts as done
  and writes nothing. Recovery's own earlier answer — a short refund, say —
  is replaced when the refund finishes.
- **An unreadable settlement record** is not read as "none": the row waits
  for the next tick.

## Tests

**`test/build-recovery-lifecycle.test.mjs`, 12 cases, through the real
lifecycle.**

How each case runs:
- the producer's real envelope (`packJob`) is consumed by the real queue
  consumer (`worker.queue`);
- the consumer is stopped where an evicted isolate stops: its first call
  after the delete, `edit_claim`, never answers;
- the test asserts the envelope is gone and the protocol record kept, with
  no credential in it;
- the site is staged or published with the real `stageBuild`,
  `activateBuild` and fence helpers;
- the row is lost, recovery runs repeatedly, and the stored customer answer
  is read back.

What the cases cover:
- **The record is written once**: a later consumer of an envelope without
  the flag cannot change what the producer recorded.
- **Outcomes**: proven non-publication (refunded 6); a successful
  publication (kept, "live"); a genuinely unknown publish claim (nothing,
  still listed, every tick); an older envelope (recorded `fenced: false`,
  stays unknown); a record that could not be written (stays unknown).
- **Failures between steps**:
  - the answer write fails after the refund (Codex's injection): repaired
    next tick, with the full amount and no second refund;
  - a crash before the settlement record: the full amount after the
    restart;
  - a crash before the delivery record: the answer unchanged, the record
    finished;
  - a failed pending clean-up: finished, and a collected answer never
    rewritten;
  - a newer authoritative answer: not overwritten;
  - a short refund that finishes later: the full amount replaces the short
    answer.

**The ledger in these tests** answers `credit_reverse` as the applied SQL
does: a repeat of the same ref and reason gives nothing new and reports what
was given before. **It is a mock, not a database.** `build_debit`'s
row-locked protocol is verified only as SQL text
(`test/build-recovery-billing.test.mjs`, the lock-order case). Nothing here
runs a Postgres transaction.

**The earlier suites are unchanged and pass**, including the concurrency and
pagination controls in `test/build-recovery-billing.test.mjs` and
`test/build-audit-batch.test.mjs`.

**Before**, on `41731e86`'s code: 8 of 11 fail. The 3 that pass are the
controls: published, a publish claim without a record, and no record.

The part-2 cases fail there partly for a part-1 reason: without the
protocol record, a staged-only build never settles, so its answer was never
attempted. Codex's own injection (case 6) is the direct reproduction of
part 2.

## Remaining gaps

- **A job filed and consumed before this code** has no protocol record and
  stays unknown when its outcome needs the flag. That is the intended
  reading of missing evidence.
- **A protocol record whose write failed** at both the producer and the
  consumer leaves that job unknown.
- **Settlement records written by the unmerged earlier branch code** have no
  `delivered` field and would be redelivered from fields they lack. This
  code was never deployed, so no such record exists in production.
- **Protocol, fence, settlement and cursor objects** are never deleted.
- **`build_debit.sql` is unapplied**. Until it is applied, the billing race
  remains in production, and the transaction is verified only as text.

## Measured

- **Sweep**: 11 of 11 killed, the comment-only control survived
  (`scripts/mutants/build-batch-p-2026-10-08.json`). The first-pass survivor
  (the protocol record overwritten by a later writer) got its own case and
  was killed.
- **Full suite** on `148cb1e4`: `10014 / 10014 / 0 / 0` locally.
- **Required CI on `148cb1e4`**: unit tests run 37759979279,
  `10014 / 9992 / 0 / 22` (totals match); site build run 37759979264, 8 of 8
  green.
- **The next image, predicted** (not built): `8b18b5eea7548730`, 198 inputs.
