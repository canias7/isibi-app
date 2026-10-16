# One image-free live verification of the integrated candidate (2026-10-16, prepared, nothing pressed)

**Candidate:** `claude/integration-parallel-publish`. It combines:
- `main` at `772bb885`;
- help-needed through `3e721154` (side-by-side writes, the publish turn and
  its fences, owned recovery notes);
- Publish through `d6515ab4` (draft-first, held changes, coherent and
  recoverable publishing, `71f7d48d`'s activation completion).

Its commit, test results and conflicts are in owner-notes, 2026-10-16
(integration candidate).

**Nothing in this plan has run.** Nothing has been merged, deployed or
built. No SQL has been applied, no switch is on, and no credit was spent
preparing it. Every step below is the owner's to approve and press.

## 1. The four blockers, cleared offline (2026-10-16)

All four were found by reading the integrated code. All four are now fixed
on the candidate, offline only, with commits and results in owner-notes,
2026-10-16 (blockers cleared).

1. **`DRAFT_FIRST` reaches a queued job.**
   - It is now in `JOB_ENV_NAMES`.
   - `test/draft-handoff.test.mjs` runs Edit, Add-on and Build jobs with
     only what their launch carried (`test/fixtures/fired-jobs.mjs`, through
     the container's own `readLaunch`).
   - With the switch on, each saves a draft and changes nothing live. With
     it off, each publishes.
   - Without the name in the list, five of the six cases fail. The
     container Edit then publishes live, which is the defect reproduced
     through the real path.
2. **The deploy delivers `DRAFT_FIRST`.** It is in `deploy.yml`'s secret
   list with an `|| 'off'` fallback, so it is off by default.
3. **The free runtime check reports both switches, three ways:**
   - `draftFirst` and `parallelWrites` at the Worker;
   - `jobDraftFirst` and `jobParallelWrites` as a job would be handed them.
     These are **calculated** from `jobSecrets`;
   - the container's own **observed** answer, from a new job-probe shape,
     `env`. It runs a real job child through `/job/run`, builds the env
     from the launch, and asks the Worker tree's readers (`jobSwitches`).
     Its launch carries only the two switch names, so no credential reaches
     the probe.

   The probe needed `readLaunch` to keep a probe's own fields. They were
   dropped before, so every probe a real container ran was the default
   `hold`; the existing test re-added them after reading, which hid it.
   That latent defect is fixed with its own test.
4. **The harness reads drafts and presses Publish.**
   - `GET …/draft?inspect=1`, owner-only and read-only, adds what was read:
     - the live pointer;
     - the running script's version;
     - the publication journal;
     - the script recovery notes (count, oldest age, window);
     - each unpublished revision's held changes by kind.

     A reading that failed says unreadable or unanswered; it is never
     replaced by a value.
   - `scripts/canary-draft.mjs` judges these checks, each pass, fail or
     unverified:
     - isolation;
     - the preview;
     - the explicit Publish (`publishPress` refuses without
       `confirm: true`), pressed twice;
     - recovery;
     - the switches.
   - `test/canary-draft.test.mjs` proves it against the real Worker, with
     negative controls.

**Still to do before a press:** the verifier is a module with an offline
proof. No workflow mode calls it yet. Wiring it into a pressable canary
scenario (inputs, opt-ins, the money gate) is the next harness step. It
touches a workflow, so it gets its own review.

## 2. The steps, in order (each the owner's)

1. **The SQL:** apply `supabase/proposed/request_beside.sql`. It lets jobs
   of one request hold the site together. Without it the second job waits,
   and side-by-side writes cannot be shown.
2. **The merge and deploy:**
   - Before merging: nothing in flight, required CI green on the final
     candidate, the image predicted over both ends, and the rollback
     checked in a throwaway worktree.
   - Read the one deploy run. The image rolls, because worker and builder
     modules change, so wait 15 to 20 minutes before container work.
3. **The free runtime check:** both readers on the new sha, a cold
   container on the new image, images **off**, and both switches still
   **off**. That reading uses `switchChecks`: the Worker, the calculated job
   value and the container's `env` probe (observed) all read off.
4. **The switches:** `PARALLEL_WRITES=on`, then `DRAFT_FIRST=on`.
   - Run the free runtime check again with the `env` probe: both read **on**
     at the Worker, as calculated for a job, and as observed in a real job
     child. A missing probe leaves the observed check unverified, never
     passed.
   - Images stay **off**: `IMAGE_PURCHASES` is read before every send.
5. **Read the balance** (the ledger, not a figure here).
6. **The presses below**, each on its own approval.

## 3. The site

- The site is `fold-lane-bakery`, at its fixture version `8btpep`, with
  `/visit`, `/order` and a `loaves` table.
- **Before anything is sent, read and keep:**
  - the live pointer and the live script's version (probe);
  - the five stored pages' hashes;
  - every `loaves` row;
  - the sidecar;
  - the draft record (expected absent or held-absent);
  - `scriptpending/fold-lane-bakery/` (expected empty);
  - the publishing journals (expected none open).
- **Afterwards:** the free restore to `8btpep`. The price row is put back by
  one owner write, conditional on the value the press set, so a saved
  version restores no rows.

## 4. The presses

### Press L1: independent writes, held as a draft (no Publish)

**The message**: one message, three independent parts:
> On the Visit page, change the opening line to "Come and see us any
> morning." On the Order page, change the heading to "Order a loaf for
> tomorrow." And make the Olive & Rosemary loaf £6.00.

**What it must show:**
- **Routing.** The real router's answer is saved before anything is
  judged: three parts with distinct targets (`/visit`, `/order`, the
  `loaves` row). If the router batches or holds any of them, the press
  says **not exercised** for the overlap. That is not a failure of the
  code, and the press is not repeated.
- **Independent writes overlap.** At least two writing jobs of the one
  request:
  - their recorded running intervals intersect;
  - each publish takes the turn in turn, rebased onto the site as it is;
  - both page changes stand in the draft.
- **Draft isolation before Publish:**
  - the live pointer, the live script version, the five live pages, the
    sidecar and every live `loaves` row are byte-identical to the
    before-read;
  - the draft record names a revision for each saving task;
  - the preview shows both texts and £6.00 (rows with the held change laid
    over them);
  - the held journal carries the row change;
  - nothing is live.
- **Money:** routing plus each job, each charged once, with no charge for
  Publish (none was pressed).

**Estimate:** about 6 to 10 credits (routing 2 to 3, two page text steps
of 1 to 3 each, a data step of 1). An estimate, not a cap.

### Press L2: a real dependency, held as a draft

**The message:**
> Add a Gift Vouchers page, and on the Visit page add a line "Gift vouchers
> are now available" linking to it.

**What it must show:**
- **Dependency ordering.** The link part's job starts only after the page
  part's job finished and saved. The page part's job (or its preparation)
  may overlap other work, but not the dependent write.
- **The words landed.** The link part lands its words with a link to
  `/gift-vouchers`. This is the structural check of `50d0aeca`/`3104c025`,
  first live use.
- **Still a draft:** live pages, menus and rows unchanged; the preview
  shows the new page, its menu links and the Visit line.
- **Money:** each charge taken once.

**Estimate:** about 18 to 26 credits (an add-on page measured at 16, a
line step, routing twice).

### Press L3: explicit Publish, then repeat (free of model calls)

**The call:** `POST /api/site/fold-lane-bakery/publish` naming the latest
revision and its version. Then the same call again.

**What it must show:**
- **First call:**
  - everything from L1 and L2 becomes live together: the pointer and the
    probed live script on the approved version;
  - all three text changes, the new page and its links, and £6.00 in the
    live row, applied **once** (one `_meta` key for this publication);
  - the journal closed;
  - the publication's own `scriptpending/` note retired.
- **Second call:** it answers `already`, with no new row, no new upload and
  no charge.
- **Live:** the addresses, read at once and again ten minutes later.

**Cost:** expected 0 credits (Publish calls no model). Read the ledger to
confirm.

### Recovery: observed, not induced

A crash cannot be caused safely on a live site. No test hook exists in
production, and adding one is out of scope. So recovery is verified only by
what a normal run leaves:
- after each press, `scriptpending/fold-lane-bakery/` holds no note older
  than its window;
- no journal stays at `switching`;
- the probed live script equals the pointer.

**Optional, free**, read 15 minutes after L3: a sweep tick has passed and
the site is unchanged. That shows the sweep leaves a settled site alone, a
normal-recovery control. **What stays unverified live:** a real death or
lost answer mid-upload, a duplicate queue delivery, and the 12 to 14 minute
repair estimate. That estimate stays conditional on the cron firing on
time, the sweep's own reads and upload succeeding, and an aborted upload
never taking effect more than 2 minutes after its 10-minute abort.

## 5. Order, stopping rules, totals

- **Order:** L1, then L2, then L3. If L1 publishes anything live, or
  changes a live row before Publish, **stop**, restore, and press nothing
  else.
- **Stop on any unexplained charge**, or on a refused or unread check.
- **The whole batch:** about 24 to 36 credits, plus the restore at 0. An
  estimate, not a cap; nothing enforces a per-request limit, so the balance
  is the only bound. The paid opt-ins are opened for these presses only
  and closed straight after.

## 6. What stays unverified even after the batch

- Crashes, lost answers and duplicate deliveries, which are offline only.
- Two real isolates racing the publish turn, beyond what L1's natural
  overlap happens to show.
- Writes from different requests: not implemented, still one at a time.
- Same-page, two settings writers and two schema writers: they wait by
  design.
- Real images: off.
- The 12 to 14 minute recovery estimate, which is conditional (§4).
- The Publish branch's own listed limits, its §7.6 and §8.5:
  - held row changes overwrite a column a visitor changed after the draft;
  - recovery needs the tick, at most 10 journals per tick;
  - the preview shows rows, not rules;
  - billing happens at save.
