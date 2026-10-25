# The failure diagnosis step, phase 1: shadow mode (2026-10-24, branch `diagnose-step`)

Owner, 2026-10-24: *"give it a try … for the next round"* (backlog: "Failure
diagnosis step for the builder"). Not merged, not deployed. Nothing spent; no
model called (supplied answers only).

## 1. What it does

When a queued build, edit or add-on part ends failed (not shipped, `ok:
false`, a 4xx/5xx, or `partial`; never a cancel or a plain success), one
model call diagnoses it with a method adapted from obra/superpowers'
*systematic-debugging* skill: the iron law (no fix without a root cause) and
four steps — read the real error and evidence, locate where it broke, one
root-cause hypothesis, one targeted fix. Never guess and retry.

- **Module**: `builder/diagnose.mjs` (no I/O, no worker imports). The method
  is `DIAGNOSE_SKILL`, a skill-like instruction; the forced tool
  `record_diagnosis` returns `kind`, `broke_at`, `root_cause`, `evidence`
  (lines quoted from the evidence), `proposed_fix`, `fix_move`,
  `retry_would_succeed`.
- **Checked**: every enum, every text non-empty, and **each evidence quote
  must appear word for word in the evidence sent** — a quote the model did
  not see is a guess, and is refused (`unseen-evidence`).
- **Evidence**: built only from recorded facts — the operation, site, the
  customer's words, HTTP status and the ended answer's fields (`route`,
  `stage`, `error`, `failure`, `partial`, `failed`, `question`, `charged`,
  `cost` …), bounded to 12,000 characters.
- **One call, no retry**; a failed call or unreadable answer is recorded as
  `unread: <why>`, never as a diagnosis. Never throws.

## 2. Shadow only

It changes no behaviour, sends nothing to the customer and charges nothing:
the worker's `diagnoseEnded` runs after the outcome is final (edit consumer:
after `edit_finalize`, the refund, the request hand-on and the reply ask;
build: after `closeBuildRow`), uses `quickSend` (the picker's quick model,
billed to no ledger), and only writes R2. A guard (DG11) holds that the helper
calls no `editRpc`, credit RPC, reply or progress writer.

## 3. The switch, and where to read a diagnosis

- **`DIAGNOSE_FAILURES`**, off by default (`deploy.yml`: `${{
  secrets.DIAGNOSE_FAILURES || 'off' }}`; uploaded; passed to container jobs
  through `edit-job.mjs`'s list). **To turn it on for the Driftwood rerun**:
  GitHub → Settings → Secrets → Actions → `DIAGNOSE_FAILURES` = `on`, then
  redeploy (the merge's deploy will do).
- **Where it is**: R2 bucket `isibi-sites`, key
  **`jobs/<job id>.diagnosis.json`** (the job id is the `edit_jobs` row id; a
  request's part carries it as its job id). `wrangler r2 object get
  isibi-sites/jobs/<id>.diagnosis.json --remote`. Shape: `{ id, op, at,
  shadow: true, charged: 0, evidence, diagnosis: { kind, broke_at,
  root_cause, evidence[], proposed_fix, fix_move, retry_would_succeed },
  usage }` (or `unread` in place of `diagnosis`). Kept seven days by the
  `jobs/` sweep.
- **Also in the Worker log** (`wrangler tail`): `diagnosis: <id> <op> <kind> /
  <fix_move> / retry <yes|no|unsure>`.

## 4. Ready for phase 2 (not built)

`fix_move` is already the phase-2 menu (`retry-with-instruction`, `re-route`,
`split`, `ask-before-charge`, `stand-in`, `code-fix`, `none`) and
`retry_would_succeed` is the gate. Phase 2 (diagnose → apply the proposed fix
→ retry once) can read `diagnose()`'s result directly at the same two hooks,
act only on a menu move with `retry_would_succeed !== "no"`, and keep the
pay-only-for-what-worked rule. Comparing phase-1 records with real outcomes
first is the owner's plan.

## 5. Fixtures: the three Driftwood add-on failures (owner-reviewed)

`test/fixtures/diagnose-driftwood.mjs`, reconstructed from the parallel fix's
description (combine-e): (1) addon routed for existing pages → partial on a
NOT NULL refusal (23502) → `misroute` / `re-route`; (2) the picker chose
nothing (`no-add`) → `empty-pick`; (3) a question after the charge →
`asked-after-charge` / `ask-before-charge`. Each runs through the whole step
with a supplied answer: one call, one record, `shadow: true`, `charged: 0`.
The exact `edit_jobs` ids were not available to this session.

## 6. XHigh

Already shipped on 2026-10-19 as "Extra high" (`public/chat.js`
`BUILD_EFFORTS.xhigh`, `XAI_EFFORTS`, sent as `reasoning_effort`). DG13 holds
it end to end (picker → accepted → `reasoning_effort: "xhigh"`; an unknown
level sends none). The label was not renamed to "XHigh" (a UI wording change
the owner can ask for).

## 7. Tests and checks

- `test/diagnose-step.test.mjs`, 15 cases (DG1–DG13; DG5 runs per fixture).
- Red check / sweep (`diagnose-step.test.mjs` only): 11 of 11 mutants killed
  — switch always on, cancel diagnosed, unseen quotes accepted, `charged` 1,
  `shadow` false, retry unchecked, `ok:false` not diagnosed, edit hook
  removed, build hook removed, deploy default `on`, container switch dropped.
  Survived: the comment-only control, and one equivalent mutant (a words
  type guard already implied). The hook-removal mutants are the red check.
- Full suite (locally, before the Dockerfile line and the log line were
  added): `12735 / 12729 / 3 / 3`. The three: `dockerfile.test.mjs` (the
  image did not carry `builder/diagnose.mjs` — fixed, `Dockerfile` line 169;
  `container-images` then passes once the file is committed);
  `canary-reopen-browser` REOPEN 1 (passes run alone: load flake);
  `no-generated-deps` case 4 (this machine's worktree; touches nothing
  changed here). Unit CI on the branch push is the next reading.
- The container image is expected to roll (`worker.js` and builder modules
  changed); not predicted here — predict before the merge (`docs/deploy.md`).
