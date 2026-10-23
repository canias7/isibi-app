# Decide money 8 (2026-10-23): S3-4, a build stopped mid-way

Builder audit finding S3-4 (#231; `docs/audits/2026-10-17-builder-audit.md`,
`docs/history/2026-10-23-r2-g5.md`). Branch `decide-money-8`, from `main`
`a8fbfe876`. Offline only: no paid run, no model call, no live write.

## The finding

When the customer pressed Stop on a rewrite (the revise build path) after it
had started, the build ran to the end and was charged in full.
`requestRewriteStopped` read the row's `cancel` flag only once, before the
build began. After that, `buildRowBeat` threw away `edit_beat`'s answer, and
the build path had no check between stages.

## The owner's choice (1)

After a Stop, the build runs no further stage, and every debit it made is
reversed. The platform absorbs the model work already done. This matches what
Stop means elsewhere.

## What changed

- **`runQueuedSiteBuild`** (worker.js) passes `stopCheck` to the build when it
  holds the row's lease. `stopCheck` calls the row's own `edit_beat` through
  that lease (the one RPC a container job may call) and answers `cancel ===
  true`. A beat that cannot be read is not treated as a stop.
- **`runSiteBuild`** checks for a stop at four points:
  - `design`: after the deposit, before the design call;
  - `provision`: after the design and settlement, before anything is
    provisioned;
  - `generate`: before the stand-in page and the page generation;
  - `publish`: inside `buildAndPublishPages`, right before
    `buildPublishGate` and the activation.

  A stop at any of these points ends the build as cancelled.
  `refundBuildByRef(env, uid, billRef, "cancelled")` reverses every ref of the
  build (`deposit`, `settle`, `pages`) in full, using the ledger's own rows. The
  build answers 410 with `{ ok: false, cancelled: true, stage, cost: 0,
  msg }`. Nothing is published, and nothing is saved as a draft, because the
  last check comes before `activateBuild`.
- **The answer the customer reads**: `STOPPED_FREE_MSG` in
  `builder/build-lease.mjs`: "That build was stopped before it finished.
  Nothing was published or saved, and nothing was charged for it." If any
  reversal cannot be confirmed, the answer carries `refundShort: true` and no
  `cost`, and the message is `STOPPED_SHORT_MSG`. It never claims a clean zero
  it cannot confirm.
- **The row** closes `cancelled` (`edit_refund p_state: "cancelled"`), not
  `failed`. The request driver's `settleRewrite` already reads
  `cancelled: true` as a cancelled part ("stopped"), with cost 0.
- **Founders** are still never credited back. `credit_reverse` is limited to
  what the ref's own ledger row took, and an exempt build has no row.
- **Too late**: a stop that arrives after the activation is not read. The
  build stays done and charged.
- No new module. `build-lease.mjs` is already in the Dockerfile's COPY lines.

## Not covered (residue)

- **The Worker-side resumed collector**: a generation fired into the
  container when the runner is off, then finished by a later invocation. It
  does not check for a stop. Under the job runner the whole build runs in the
  container, and the checks above apply there.
- **A first build stopped during generation**: the stand-in page that went up
  before generation stays at the address. A revise has no stand-in, because
  its site is already live.
- **The phone-app branch** (`writePhoneApp`) is checked before it starts (the
  `provision` check), but not between its write and its debit.
- **Photograph purchases** are billed under their own refs, not reversed by
  this path. `IMAGE_PURCHASES` is off.

## Tests

New: `test/build-stop-midway.test.mjs` (7 cases). Each runs through the real
`worker.queue` consumer, with a supplied design answer and faked network:

1. A stop read at the first beat refuses the design call. Only the deposit was
   debited, all three refs are reversed `cancelled`, the row closes
   cancelled, and nothing is published.
2. A stop after the design refuses provisioning, with no later model call.
3. A stop after provisioning refuses page generation: no page writer, no
   stand-in.
4. An unconfirmed reversal answers `refundShort` and the short message, with no
   `cost`.
5. Control: with no stop, the build runs as before, nothing is reversed as
   stopped, and every stage asks.
6. Structural: the last check is right before `buildPublishGate`, and nothing
   after `activateBuild` reads a stop.
7. A stop that arrives after every check changes nothing: the same status,
   debits, reversals and row close as the control.

`test/build-jobs.test.mjs`: two spelling guards were updated for the new
`stopCheck` argument.

**Red check**: the new test file was run against `origin/main`'s `worker.js`,
with the new message constants in place. Six of seven fail. Case 7 passes on
both, as a control should. Case 5 fails on the old code only because it
requires the stages to ask.

**Mutation sweep**: 5 mutants, all killed, from a saved copy of the fixed
file, restored from that copy afterwards:

- M1: the stop is never read. Killed, 4 cases fail.
- M2: the design check is removed. Killed, 4 cases fail.
- M3: no reversal. Killed, 4 cases fail.
- M4: the row is closed `failed`. Killed, 3 cases fail.
- M5: the publish check is removed. Killed, 1 case fails (the structural
  case: the fixture's page writer never reaches publish).

The comment-only control survived.

**Files run**:
- First set, 1,331 tests, 1,331 pass: `build-*`, `request-*`, `credit-*`,
  `container-*`, `job-*`, `api-auth`, `deploy-*`, `edit-job` and
  `brand-rename`.
- Second set, 1,276 tests, 1,276 pass: the other files that name the build
  path (`app-write`, `band-build`, `canary-build`, `collector-busy`,
  `draft-retention`, `edit-matrix`, `handover-batch2`, `page-gen`,
  `progress-more`, `publish-integrity`, `publish-pages`, `revise-keeps-pages`,
  `ship-anyway`, `site-*` as listed, `trace`, `turn-fence`, `wiring`,
  `worker-imports`, `edit-failure-paths` and `edit-reserve-refused`).

The full suite was not run.
