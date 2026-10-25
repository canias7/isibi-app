# 2026-10-25: a job a person stopped is not diagnosed

Branch `fix-diagnose-cancel` from `origin/main` `b12dba52c`. Not merged, not
deployed. No model call, no live write, nothing spent.

## What happened live

2026-10-25 01:45 UTC, `driftwood-and-daughters-5`: two edit jobs were stopped
by a person through the request's Stop (`DELETE /api/site/request/<slug>/<key>`
→ `stopRequest` → `edit_cancel`). Read from Supabase (`ujrqdmmtcptvimazlhom`,
non-secret columns only):

| job | state | cancel_requested_at | answer |
|---|---|---|---|
| `722524f108af546625cdd18a8c2c4da1` | failed | 01:45:44.33 | 422 `compile`, `detail: "cancelled"`, "our build service was restarting" |
| `b12899f91ee08eecc39e3fc882b6fc2b` | failed | 01:45:44.44 | 422 `compile`, `detail: "cancelled"`, "built but couldn't be published (cancelled)" |

Neither answer carries `cancelled: true`, the only stop signal
`needsDiagnosis` knew, so the shadow diagnosis ran and called them a
build-service restart / publish step cancelled, fault provider/unknown.

## The fix

- `builder/diagnose.mjs`: `needsDiagnosis` takes `stopped`; `diagnoseJobEnded`
  takes `deps.stopped` (async), read only when the answer looks like a
  failure. `true` ends the step: no model call, no record. A throw or anything
  but `true` is cannot-tell and diagnoses as before.
- `worker.js` `diagnoseTools`: the job row now selects `cancel_requested_at`;
  a request-stop reader (`rec.stop`, or the part in `rec.stopParts`) from the
  job's request record; `stoppedByPerson` (row or request) is split off and
  passed as `stopped`, never offered to the model; `read_job` returns
  `cancel_requested_at` and `requestStop` for borderline cases.

## Checks

- `test/diagnose-stopped.test.mjs` (4 cases, the live 722524f1 answer);
  `test/diagnose-tools.test.mjs` DT6's wiring assertion updated to the split.
- Red check on `origin/main`'s sources: DS2 and DS4 fail, DS1 and DS3 pass.
- Sweep: 8 of 8 mutants killed; the comment-only control survived.
- Full suite: `12772 / 12768 / 1 / 3`; the one failure is `no-generated-deps` (this machine's linked `node_modules`; it fails the same way in other worktrees here).
