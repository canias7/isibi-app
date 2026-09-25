# Bounded add-on escalation correction

**CLOSED — independently reviewed, merged, deployed and runtime verified.**

Reviewed/deployed SHA: `5cb8592661ffee5db1d1e0adc412f75a4760de82`.
The owner independently confirmed 437 focused tests and both green CI checks.
[Deploy 2156](https://github.com/canias7/isibi-app/actions/runs/36094441082)
succeeded. [Canary 28](https://github.com/canias7/isibi-app/actions/runs/36096052737)
at **2026-09-25 04:50:36 UTC** reported Worker `5cb8592661ff` and container
`b83b0611aeecce8f`; expected identity checks and all free checks passed.
Spending was disabled; recorded balance was **3**. The owner independently
verified this evidence. No further deployment check or retry is needed.

The earlier 04:32 canary observed the previous image around three minutes after
deployment. It remains historical evidence, superseded for readiness by the
successful post-window check; no root cause beyond those observations is claimed.
No paid edit, demo-site repair or forced restart was performed. Translation and
model-written replies remain parked. [Remaining checklist](edit-path-checklist.md).

| Outcome | Server decision |
| --- | --- |
| Empty input; missing configuration; empty/invalid picker | Stop with an explanation |
| Failed/malformed source, config, legacy config or schema reads | Stop; unreadable is not absent |
| Editable recovery throws or returns `ok:false` | Stop and retain the recovery result |
| No usable pages, unchanged output, unknown failure reason | Stop; preserve specific refusals and model notes |
| Stylesheet present but saved look absent | Stop; existing styling is not an absent design |
| Positively absent source or design | Reconstruct only after readable remaining state, successful editable-state check, and build configuration checks |
| Photo alone | Existing picture-layer handoff |

Strict reads are opt-in for this route. Other callers keep their existing read
contracts. Legacy config fallback and genuine empty schemas remain accepted.
The browser already distinguishes an explanatory refusal from an explicit
escalation; no browser product code changes are needed.

`test/addon-failure.test.mjs` now feeds actual Worker responses into the real
direct and queued browser handlers. Stops assert no edit handoff and no rewrite
POST. Cases include missing source combined with unreadable config/backend/schema,
malformed stored values, returned editable-recovery failure, partial recovery
writes, and provisioning followed by unusable output. Controls cover successful
additions, legacy fallback, empty schema, successful recovery, reconstruction,
and photo-to-picture handoff. Future unknown reasons are helper-produced controls,
explicitly separate from reachable current route responses. All external services
and model providers are stubbed; no paid calls are made.

Messages describe the stopped addition without claiming the entire request was
free or unchanged. Routing may already have charged credits; recovery, legacy
backfill or backend provisioning may already have written state. Existing model
notes and explanatory refusals retain precedence.

Local validation: 169/169 in the browser/route integration, config and editable
state suites. The larger five-file focused run has 452 passes and four existing
Windows URL-path failures (`C:\\C:\\...` in template-render fixtures). These are
not altered by this patch; Linux branch CI is the full-suite authority.
