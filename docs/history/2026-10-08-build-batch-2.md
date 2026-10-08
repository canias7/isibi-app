# The second Build correction batch (2026-10-08)

Codex reviewed `b4300a07` (the first batch's records over `c7aaf1e5`). Using
the real helpers and gateway policy, they reproduced four gaps:

1. **`attachedNames` cut file names at 80 characters.** Two uploads sharing
   that prefix could not be told apart, and choosing the second name stored
   the first image's bytes.
2. **`lostBuildVerdict` treated any pointer activated after the build began
   as that build's publication**, a different edit included.
3. **`sbDecision` rejected `build_debit`**, so a container-run build could
   never reach it.
4. **`buildLedger`'s successful bearer path skipped the job-state check.**

The owner asked for all four to be fixed together as universal behaviour,
and added more:

- close the documented lost pages-debit answer;
- keep unresolved recovery discoverable past one day;
- inventory the other Build limits;
- record their clarification: page maximum 1 and component maximum 15 stay,
  and every other limit is reviewed on its own.

Nothing was merged, deployed or built. There was no paid call and no live
SQL.

## 1. Attachment identity

- **`attachments()` (`builder/site-context.mjs`) mints the identity.** Each
  file it hands the model gets `attachment-<n>`, its position in the request
  (`attachmentId`). It also returns `named: [{ id, index, name, kind }]`. The
  name is the original, kept to 300 characters for display only.
  - A file the reader refuses keeps its position.
  - So the ids after it still name their own files.
  - The old `attachedNames` re-derived the list separately and mis-mapped
    every file after a refused one.
- **The designer is told the ids** (`attachedFilesNote`). The `images` tool
  field asks for the id, never the file name.
- **Placement resolves by id** (`resolveAttached`). A bare name is accepted
  only when exactly one file has it. A shared name, a prefix or an unknown
  id is refused with its reason and told, never guessed. Bytes are read at
  the id's own index (`attachedImageBytes`). The stored plan entry keeps
  `attached: <id>` beside its `src`.
- **Resume**: the files kept beside the resume record are
  `{ v: 2, blocks, named }`. A refire reads either that or the older list.
  The build's args carry `attachmentIds`, which `buildAndPublishPages`
  accepts but does not read.

## 2. Publication attributed by evidence

- **The pointer and each version manifest name the build's own job**
  (`job: jobId`).
- **The build fence**, `jobs/<id>.fence.json`, is one object per job,
  created only if absent (R2's `etagDoesNotMatch: "*"`):
  - a build claims it as `publish` right before activating
    (`buildPublishGate`);
  - recovery claims it as `recovery` before deciding;
  - whoever writes first owns the outcome;
  - a successful activation records the version on the fence
    (`markPublished`), because the pointer moves on and versions are pruned
    to two;
  - a failed activation records `failed`. It never erases a version a
    duplicate delivery already recorded, and leaves an unreadable fence
    alone.
- **`lostBuildVerdict`** checks the evidence in this order:
  - **published**: the fence's recorded version, the pointer naming the job,
    or a manifest naming it;
  - **unknown**:
    - a read failed;
    - the publish holds the fence with no record (it may be activating);
    - a version that names no job was written after the build began, and
      the job predates the fence;
  - **not-published**: anything else, including a later edit naming another
    job;
  - **a fenced job**: one whose record says `fenced: true`, set by
    `packJob` for every job written from now on. When recovery holds its
    fence, or its publish recorded a failure, the answer is not-published:
    its publish could only have followed a claim.
- Timestamps never decide an outcome. They only make one unknown.

## 3. Late workers, duplicate delivery and billing

- **The publish gate** is the last step before the pointer.
  - It refuses when the row is lost, failed or cancelled, when recovery
    already claimed the job, or when the claim cannot be made.
  - A duplicate delivery of the same job finds its own claim and goes on;
    the pointer's etag decides between them.
- **The job-state guard** runs before every build debit, on the bearer path
  and on `build_debit` alike, whatever the token. A row that is lost,
  failed, cancelled, unreadable, or whose recovery holds the fence is
  charged nothing (`err.jobState`). No row at all (a build filed without
  one) bills as before.
- **The queue consumer and the resumed collector** do not write their answer
  when recovery owns the job, so a late worker cannot overwrite recovery's
  answer.

## 4. The container's billing path

- **The job gateway admits `build_debit`**, bound three ways: the token's
  job id, the token's account, and exactly one of the job's three refs
  (`BUILD_STEP_REFS`). The gateway supplies the mint proof.
- **It also admits one ledger read**, `credit_events`, filtered by the
  token's account and exactly one of those refs.
- **The SQL stays an unapplied proposal**
  (`supabase/proposed/build_debit.sql`, README updated).

## 5. The lost pages-debit answer

- **`debitPagesReconciled`**: when the pages debit throws, the ledger is
  read back by ref (`credit_events`, `delta < 0`).
  - A debit row found is the amount taken.
  - Not found, or unreadable, throws `chargeUnknown`, never zero.
  - A refusal on the job's state is known (nothing charged) and passes as
    it is.
- **`publishPages`** carries `out.chargeUnknown`, and its settle sentence
  says the charge is being checked.
- **The build's reply** carries `chargeUnknown`.

## 6. Recovery that does not age out

- An unknown outcome, or a refund that fell short, is listed under
  `recovery/pending/<id>`.
- Every tick reads those ids back from `edit_jobs` by id, whatever their
  age. The one-day window only bounds which new lost rows are picked up.
- A settled build leaves the list.

## 7. The Build limits

The inventory and its proposals are
`docs/investigations/build-limits-2026-10-08.md`:

- **kept**: `MAX_PAGES` 1 and `MAX_COMPONENTS` 15;
- **silent drops found**, notably a customer's third attached photo, cut by
  the plan's two-image cap before it is counted;
- **proposals P1–P11** await review; none is implemented.

## 8. Tests and verification

- **`test/build-audit-batch.test.mjs`**, 61 cases. Earlier H6/H1 cases were
  rewritten to ids and evidence. New cases:
  - **identity (N1)**: an 80-character shared prefix, duplicate names, a
    refused first file, and resume, in both the older and the id form;
  - **attribution (N2)**: an unrelated later edit, an unattributed version
    for an unfenced and a fenced job, a fence record or manifest after the
    pointer moved, a publish in flight against a failed one, and pending
    retried three days later with its control;
  - **late workers and billing**: a late worker after recovery, a dead row
    before recovery, duplicate delivery, expired and valid tokens against a
    lost row, an unreadable row, a recovery-held fence, and the consumer not
    overwriting recovery's answer;
  - **gateway**: refusal of another account, job or reference for both
    `build_debit` and the ledger read;
  - **pages debit**: an ambiguous answer, found, not found and unreadable.
- **`test/publish-pages.test.mjs`**: `chargeUnknown` through `publishPages`,
  with a control.
- **Updated pins**: `sb-gateway`, `credit-debit`, `build-job`,
  `build-params`, `site-builds`, `site-context`.
- **Red check** on `b4300a07`'s code, with the test file made tolerant of the
  missing exports in a throwaway worktree: 31 of 61 fail, including every
  new boundary case. The 30 that pass are the first batch's unchanged
  behaviour. The `publishPages` case fails there too.
- **Sweep, full suite, CI and image**: see the owner-notes handoff for the
  measured numbers.

## 9. Limits that remain

- **`build_debit` SQL unapplied** (the owner's word). Until then an expired
  bearer's debit fails as before, on either side.
- **The bearer path's state check is a read before the debit, not one
  transaction.** A row turning lost in between, or a debit landing after
  recovery's refund, is not caught. The applied function checks the row in
  the same statement.
- **A row marked lost after its publish and before its pages debit** leaves
  the pages uncharged.
- **A pre-fence job with an unattributed later version stays pending** and
  is retried each tick, unresolved until evidence or review.
- **`credit_reverse`'s gateway binding is still a prefix.**
- **Fence objects are never deleted.**
- **A real model's use of the attachment id is unmeasured.**
- **The reply cannot see whether the writer placed the photograph.**
