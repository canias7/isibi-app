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
