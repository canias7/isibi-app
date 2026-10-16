# Jobs of one request side by side (2026-10-15)

Branch `claude/help-needed-ehlwlj` only. **Not merged, not deployed, no
container image built, the SQL not applied, the switch off.** Nothing paid.

## What was asked

Concurrent independent Edit/Add-on execution inside one request: only real
dependencies and conflicting changes run in order; publication coordinated
safely; the current dependency, target, recovery and billing machinery
reused; never "remove the guard", never stale whole-site snapshots
overwriting each other. Proven offline: real execution overlap, both
outcomes kept, dependency order, duplicate delivery.

## What stood in the way (mapped from the code)

1. **The driver.** `nextStep` filed a write only when no job of the request
   was live (`!live`).
2. **The site's lock.** `private.site_busy` (in `edit_claim`) refuses any
   claim while another job on the slug holds a live lease or is publishing,
   from claim to finish. Even with (1) gone, a second job is deferred.
3. **The publish.** Every publish writes the site whole (pages, parts,
   config, sidecar) from the list its job read at its start; the only
   compare-and-swap is on the live pointer, read minutes after that list.
   Two jobs publishing as they stand would each put back what the other
   changed.
4. **Stores rewritten whole with no version check, whatever a step's
   targets say.** The config (`patchSiteConfig`: the look and logo steps and
   an addition write it before they publish, and put a snapshot back when
   they fail) and the database schema (`applySiteSchema`: rules and an
   addition apply the whole merged spec).
5. **The editable-state repair** (`ensureEditableState`) assumes one writer:
   between another job's config write and its publish, or between its
   activation and its source write, it would "repair" what is simply not
   finished.

## What changed

**The filing rule** (`builder/request-plan.mjs` `clearToWrite`,
`besideConflict`, `holdsConfig`; `builder/request.mjs` `nextStep`'s
`writeMax`, which returns `files`):
- With `writeMax` 1 (the switch off) nothing changes.
- Above 1, a `ready` part (its `needs` met) is filed beside the running jobs
  of its request when it conflicts with no running part, and with no earlier
  unfinished part in the apply order.
- **Conflict** is `conflicts()` on targets (write/write, and write/declared
  read), **plus** both writing the config (look, logo, addition, or a
  `theme`/`identity`/`site` target), **plus** both writing the schema (rules,
  addition, or a new table/function/connection/schedule).
- What one step merely reads changing beside it is not a conflict: each job
  plans against the site as it began, and its publish applies only its own
  changes. Where one change rests on another, the model said so (`needs`) or
  code inferred it (`inferNeeds`).
- A routing writes nothing. It waits only for a running or earlier part
  whose writes feed its page or table list.
- At most `WRITE_BESIDE_MAX` (3) jobs of one request at once.

**The site's lock** (`supabase/proposed/request_beside.sql`, **proposed, not
applied**): `private.site_busy` exempts another live job of the **same
request and account**, read from each row's own `idem_key`
(`<request key>-p<n>-<seq>`). Every other blocker is unchanged: other
requests, page edits, builds, the rebuild. Safe either way round: with the
switch off the exemption is never reached, and with the switch on and the
SQL absent the second job waits on the lock as before.

**The publish turn and the rebase** (`builder/publish-turn.mjs`;
`worker.js` `recompileAndPublish`, `takeTurn`, `tryTurn`, `giveTurn`,
`renewTurn`, `noteBase`):
- A request job running with the switch on publishes under the site's turn
  (`publish-turn/<slug>.json` in R2, written only on its etag, lapsing after
  10 minutes unrenewed, renewed with the job's heartbeat, given back only
  while still the holder's).
- Under the turn it:
  - checks the editable state as the turn's holder;
  - reads the site as it is now;
  - publishes `rebaseFiles(base, mine, current)`: its own changes onto the
    current files, by path (components by name).
- A file it did not change is published as stored now. A file both it and
  another job changed differently is a **conflict**: refused, nothing
  written, our side, refunded by the existing failure path.
- The base is what the job's route first read: the pages, and the
  components read at the same moment (`noteBase`).
- A step that writes the config (`holdsConfig`) takes the turn before its
  first read and holds it to its end, so no other publish or repair runs
  between its config write and its publish.
- The editable-state repair, with the switch on, writes only under the turn.
  An asker without it takes the turn for the check; finding it held, it
  leaves the repair to the holder, who checks again before publishing.

**The switch** `PARALLEL_WRITES` (`deploy.yml`, fallback `off`; forwarded
to container jobs in `builder/edit-job.mjs`).

## Reused, not rebuilt

- The dependency graph (`needs`, `inferNeeds`, `applyOrder`).
- The targets (`effectiveTargets`, `conflicts`).
- Preparations and their exact replay.
- The claim, the lease, the heartbeat and `edit_may_publish`.
- The pointer compare-and-swap.
- The refund and failure paths.
- The ledger keyed by `(ref, reason)`.
- Idempotent filing (`edit_jobs_idem`), the claim's refusal of a leased
  row, and the request record saved on its etag.

## Proven offline (`test/concurrent-writes.test.mjs`, through the real Worker; `test/request-beside.test.mjs`, the pure rules)

- **CW1, execution overlap with both outcomes kept.** The Visit job's model
  call answers only once the home job's change is on the stored site. So
  the home job ran from claim to publish while the Visit job held its lease
  inside its call. The Visit job then published from its old copy, and the
  home change is kept. Each job was charged once, and the turn was given
  back.
- **CW2, conflicting changes wait.** With two changes to one page, the
  second part's edit job is never filed while the first runs. Both are
  kept.
- **CW3, a dependent part waits.** With `dependsOn` set, the dependent part
  files no job of any kind until its prerequisite ends.
- **CW4, duplicate delivery.** The beside job's message was handed to two
  consumers at once. It ran once, was granted its publish once, and was
  charged once.
- **CW5, a real overlap caught at publish.** The Visit job also changed the
  home line, which the home job had already published differently. The
  Visit publish was refused as a conflict, and nothing of it was written.
  The home change stands, and its reserve came back in full.
- **CW6, the switch-off control.** No second job of any kind is filed while
  one runs.
- **CW7, one publish at a time.** With the site's turn held by another job,
  a request job with its change ready publishes nothing until the turn is
  given back. It then takes the turn, publishes once, and gives it back.
- **Pure cases:** NS1–NS5 (`nextStep` files), BC1 (config/schema), CTW1
  (order vs running), RB1–RB2 (rebase, malformed input), TN1 (turn).

**Red checks** (each mutant restored by file copy):

| Mutant | Cases that fail |
|---|---|
| R1, no rebase on the success path | CW1, CW4 |
| R2, one job at a time despite the switch | CW1, CW4, CW5 |
| R3, conflicts ignored when filing | CW2 |
| R4, the lock without the same-request exemption | CW1, CW4, CW5 |
| R5, the old whole-copy publish beside another job | CW1, CW4, CW5 |
| R6, the dependency ignored | CW3 |
| R7, filing beside with the switch off | CW6, after it was tightened: it first survived, because the lock hid the extra filing |

**Mutation sweep** (25 mutants from a green baseline of the two focused
files, restored by file copy): **21 of 24 killed** on the first pass, and
the comment-only control survived. The three survivors:
- **"logo not a config writer": equivalent.** A logo route already implies
  an `identity` write, which is a config write.
- **"many at writeMax 1": equivalent.** With a cap of 1, the side-by-side
  branch files at most one job, the same pick as before.
- **"no turn taken": a real gap.** No case showed a publish waiting for the
  turn. CW7 was added for it and kills it, so the sweep now stands at 22 of
  24, with two equivalents.

**Full suite.** The first run on `65377c0b` gave 10,971 passed and 21
failed out of 10,992; all 21 were source-text guards and the image's file
list, and none was a behaviour regression. The second run on `f19da1e6`
gave 10,991 of 10,992. The last failure was the editable-reader census:
the publish path read the source directly. It now checks the editable state
as the turn's holder and reads through `loadSiteSourceForEdit`. The suite
on the next commit is `6f343e7a`: **10,993 / 10,993 / 0 / 0** locally (full offline suite).

## Not done, not shown

- **The look/logo/addition config holders** are proven by the pure rule
  (`holdsConfig`) and the runner wiring only. No offline case drives a look
  step beside a text step through the Worker.
- **The turn's mutual exclusion under real parallel isolates** rests on the
  R2 etag write, which the fixture honours. Two Workers racing the same
  write are not exercised.
- **Nothing is live.** The SQL is unapplied, the switch is off, and nothing
  is merged or deployed. **No live press has shown two writing jobs of one
  request overlapping.** The approved verification batch (`8e24ca5b`,
  deployed) cannot show it: it was prepared before this work.

## Follow-up the same day: the turn's ownership, a config writer beside a text job

The owner's review: `renewTurn` could answer no and the heartbeat dropped
it, and `takeTurn` trusted a turn cached on the job.

- **Ownership** (`1e3c01e8`, corrected in `b9ac6ae7`): `turnHeld` reads the
  stored turn; `turnStillMine` answers whether a job running beside others
  may write the site, and a turn found to be another's or lapsed is lost
  (`loseTurn`). The heartbeat acts on a refused renewal; `takeTurn` re-reads
  a held turn and never takes back a lost one; the commit point re-reads it
  before the publish grant; `ensureEditableState` repairs only while its
  named holder holds it and leaves a config holder's own write in place
  (`keepConfig`); every job config write and put-back is preceded by the
  ownership check (`mayWriteConfig`). Loss stops the job at its next gate
  (`turn-lost`), and `edit_refund` refunds it.
- **Cases:** CW8 (whole-site holder loses its turn in its model call), CW9
  (description holder loses it at its compile, after its config write),
  CW12 (a page change loses the turn it took for its publish): none
  publishes, repairs, writes or puts back the config, or touches the newer
  holder's turn; each is refunded once. CW10/CW11: a description change
  beside a Visit text change — side by side, both kept, each charged once;
  the description's compile failing once is put back and refunded with the
  Visit change kept, and asked again it lands, charged once.
- **Sweep:** 13 mutants, 10 killed, the comment-only control survived.
  Survivors: the heartbeat's refused renewal (no 30 s beat is driven) and
  `takeTurn`'s cached-turn and lost-turn checks, repeated by the
  editable-state and commit-point checks in every current call order.
- **Still not shown:** two real isolates racing the turn; a live overlap.
  A stale config write left by a job that lost its turn between its write
  and its put-back stays until the next publish's editable-state check.

## Follow-up the same evening: ownership enforced at the write

The owner reproduced a race the earlier checks could not close: a holder
passed `mayWriteConfig`, paused inside its config read, lost its turn, and
then wrote over the newer holder's description and CSS while answering ok.

- **The fence** (`b49d8765`): each turn's record carries `gen`
  (`nextGen`: above the stored turn's, never below the clock), kept through
  `renewTurn` and `giveTurn`. A job running beside others writes the
  guarded keys (config, pointer, head, source, parts, kit) only through
  `fencedPut` / `patchConfigFenced`: the key's `customMetadata.fence` and
  etag are read, a larger fence refuses (`TURN_FENCED`), and the write is
  conditional on that etag and stamped with the job's own fence. The
  spine's activation uses `fencedBuildDeps`; a refusal there is
  `turn-lost`.
- **The new holder first** (`stampFences`, `ensureEditableState` with
  `fence`): the pointer, head and config are re-written as they stand,
  stamped, then the editable state is repaired under the fence. A step that
  holds the turn from its start does this before it reads anything, with
  the config put back to the live version — abandoned settings never reach
  its publish.
- **Unchanged:** with `PARALLEL_WRITES` off nothing is fenced
  (`jobFence` answers null). Unfenced config writes keep a stamped fence.
- **Cases:** `test/turn-fence.test.mjs` TF1–TF10 (see owner-notes,
  2026-10-15 evening). Sweep 17 mutants, 15 killed, control survived.
- **Not fenced:** the site script's upload (not R2); keys that do not exist
  yet (no pointer, no R2 config).

## Follow-up the same night: content etags, keys not there yet, the script

Codex reproduced, with the exported `siteTurn` functions, a stale write
over an identical-bytes stamp: R2's single-put etag is the body's MD5, so
the stamp kept the etag and an etag-only condition let the stale put land.
The fixture's counter etags had hidden it (and TF5/TF6's paths too).

- **The fixture** now derives etags from the body (MD5), keeps a strictly
  increasing upload clock, and honours `uploadedBefore`/`uploadedAfter`.
- **`sinceRead`**: every guarded write and stamp is conditional on the
  etag AND `uploadedBefore` just past the read's upload time.
- **Held keys**: `POINTER_NONE` (read as no pointer; activations key on
  `readPointerTag`'s etag; undo restores it) and a created config for a site
  without one (legacy read or empty; an unreadable legacy read refuses).
- **Sidecar and live marker** joined the guarded keys and the stamp.
- **Script**: `scriptStillOurs` before the upload, `alignLiveScript` after
  it and at takeover (`probeSiteWorker`, where the binding exists).
- **Cases**: TF11, TA1, TA2, TS1–TS4. Sweep 15 of 15 killed after two
  added cases; control survived.
- **Integration with main** (`772bb885`) checked in a local worktree
  (`d800ad64`): two hand resolutions (Dockerfile union, owner-notes), full
  suite green apart from one failure caused by the check's own symlink.

## Closed (2026-10-15): owned recovery notes, and what remains

- **Absent keys and rollback** (`45c163d3`, `6c492b16`): keys are held
  absent in the store and never deleted on rollback.
- **Recovery notes** (`9da48fe2`, `d583030d`): owned per invocation; other
  invocations' notes are retired only after their window, by a conditional
  tombstone.
- Codex reviewed the batch at `66cbeb55`. CI: unit 38818063004 and site
  build 38818062911 on `d583030d`; integration `c9ef979d`, unit 38819883606
  (11,232 tests, 0 failing) and site build 38819883654.
- Recovery timing, the open items and the next-batch choices are in
  owner-notes, 2026-10-15 (closing), §4 to §8.
- Still nothing live: the SQL is unapplied, `PARALLEL_WRITES` is off, and
  nothing is merged.

