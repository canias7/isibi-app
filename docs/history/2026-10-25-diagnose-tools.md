# 2026-10-25: the failure diagnosis investigates (branch `diagnose-tools`)

From `origin/main` `c985956c0`. Not merged, not deployed. Nothing spent: no
model call, no live write. Supabase was read (non-secret columns only) to build
the fixtures.

## Why

Live, the shadow diagnosis (`builder/diagnose.mjs`, `diagnoseEnded` in
`worker.js`) answered "can't establish a root cause" for all three real
Driftwood failures. It saw only the job's final answer fields. The owner wants
it to investigate the way a person debugging would, without being handed
everything.

## What changed

- **A short read-only tool loop** (`investigate`). The model may call up to
  `DIAGNOSE_MAX_TOOL_CALLS` = 6 tools. After that, `record_diagnosis` is forced
  (`tool_choice` names it); at most 8 turns. The tools:
  - `read_job`: the job's `edit_jobs` row (id, slug, op, state, phase,
    billing, cost, worker_status, needs_review, review_note, times, phase_ms,
    error) and its parsed final answer. No uid, lease or idem key.
  - `read_trace`: the site's `edit_traces` in the job's window, from one
    minute before the row to its last update, at most 4. A trace is keyed by
    its own `cid`, not the job id, so the window is the link.
  - `read_route`: the part's own record first. The job body's
    `request {key, part}` gives the request record, which gives `parts[n].route`,
    `held`, `putOff` and `question`, plus the router's raw answer from that
    part's route job (intent, decision.reasons, targets with writes and reads,
    alsoAsked, questionFor). If there is none, it falls back to the site's last
    `op=route` row before the job, labelled `matched: "latest-before-job"`.
  - `list_site`: page routes (`sitePageRoutes`) and the tables from the stored
    spec, with each column's name, type, NOT NULL and default where the spec
    has them.
  - `read_page`: one page's source, cut to 5,000 characters.
  Each tool is bound to the one job and site by `diagnoseTools(env, {id, slug, b})`.
  A failing or missing tool answers "unavailable: …" and never throws. Each
  result is cut to 6,000 characters.
- **Quotes are checked against everything seen**: the evidence plus every tool
  result (`seen`, kept in the record up to 60,000 characters). A quote from
  nowhere is still refused.
- **`fault`** is a new required field: `ours`, `model`, `provider`,
  `customer` or `unknown`.
- The record also keeps `investigation` (the tools called and their inputs).
  It is still shadow only: `shadow: true`, `charged: 0`, nothing shown to the
  customer, and it never throws. Without `tools`, the old single call is
  unchanged.
- For a model that answers in prose, the loop asks once more. xAI has no
  `tool_choice: any` mapping, so it runs on auto until the record is forced.

## The three real failures (fixtures: `test/fixtures/diagnose-tools-driftwood.mjs`)

| job | what the rows show | the supplied correct answer |
|---|---|---|
| `2124dc02…` add-on, failed, cost 0 | route `896cf94c…`: `intent addon`, writes `data:lessons`, `page:/lessons`; the site already has `/lessons` | misroute, fault ours, re-route |
| `6f7583f4…` add-on, failed, cost 0 | answer `reason layer`, `escalate`, `layer nav`, `kind frame`; route `7844b721…` writes `menu`, `footer`, `data:newsletter_signups` | misroute, fault ours, re-route |
| `75f25f2f…` edit, 422, cost 6 refunded | `problems: ["footer:kit:@/components/ui/figure"]`, `billing refunded` | invalid-model-output, fault model, retry-with-instruction |

These answers are supplied to the tests. No real model has been asked yet.

## Tests

`test/diagnose-tools.test.mjs`, 8 cases:
- DT1: the tools and `fault`.
- DT2 ×3: each real failure. The loop runs exactly the scripted tools in order. The correct answer validates and is recorded. At least one quote exists only in a tool result.
- DT3: an unseen quote is refused.
- DT4: the 6-call budget, with the record forced on the very next turn.
- DT5: a throwing tool, prose, a failed call and a missing tool.
- DT6: the worker wiring, read-only, with no secret columns.

`test/diagnose-step.test.mjs` is unchanged except that its fixture now supplies `fault`.

- Red check: on `origin/main` the new file fails (no `DIAGNOSE_INVESTIGATE` export).
- Sweep: 8 of 8 mutants killed and the comment-only control survived. The first run had a surviving budget mutant, so DT4 was tightened to check the exact turn.
- Full suite: see the owner-notes entry.
