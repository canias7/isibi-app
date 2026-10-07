# The combined release, deploy 2188, and its live verification (2026-10-07)

The owner: *"Proceed with docs/investigations/combined-release-plan.md: I
approve releasing the prepared batch and running its one combined live
verification, with a maximum spend of 40 credits. Preserve the reviewed
recovery fixes and completed green CI evidence. Before merging, perform the
plan's preflight … Then fast-forward main once, deploy and build the container
image once as required, verify the served frontend and running Worker/container
versions, and complete the free runtime check before spending credits. Run the
prepared lv-combined scenario once … Keep the planned 38-credit stopping
threshold and 40-credit hard cap; do not add funds, automatically rerun a
failed paid scenario or start extra paid tests. If a gate fails, stop … Perform
the steps yourself wherever access permits; if a required action is blocked,
name the exact action and access error. Leave the demo changes in place."*

## 1. The preflight (23:03–23:04 UTC), all passed

| Check | Reading |
|---|---|
| The candidate | `9d6bda8a`, the branch tip; `main` `bcc22295` its ancestor; 36 commits |
| Product changes since the reviewed batch | **none**: since `092ff48a` (Codex's 90 assertions) only docs, tests, canary scripts and the dispatch-only canary form `.github/workflows/edit-canary.yml` changed; between `570adb45` and `092ff48a` only docs. `site-provision.mjs` and `site-db.mjs` are as reviewed |
| Test inputs | the site build's gate green on `570adb45` (run 37674861320, attempt 2, 404 checks), its inputs `de6345b9058cd1cc` (3,974 files) the same at `9d6bda8a`; unit CI green on `9d6bda8a` (run 37698296313, `9885 / 9863 / 0 / 22`) |
| Nothing running | no Actions run in progress or queued, read at 23:04 and again right before the push; no open job in `edit_jobs` in any account |
| Balance | 40, the ledger's last row 401 (23:03:55) |
| The image | predicted with the deploy's own functions: `5f946c22d42a1b10` (195 inputs) → `335396c8c0e0fbcb` (196 inputs), at `092ff48a` and `9d6bda8a` alike |
| The rollback | `git revert --no-commit bcc22295..9d6bda8a` in a throwaway worktree gives back `main`'s tree, `dcd4e727…`, exactly |
| The served file before | `chat.js` 920,280 bytes `0e68e324…`, `bcc22295`'s own (23:04:25) |
| Skip-CI marker | absent from all 36 messages |

## 2. The merge and deploy 2188

`main` `bcc22295` → `9d6bda8a`, one fast-forward push at 23:04:49 UTC. Run
37700151308 (deploy 2188), the only run it started, `success`, 23:04:56–23:08:07:
- the image **built** `335396c8c0e0fbcb` (196 inputs) as predicted, the
  container rolled `5f946c22d42a1b10` → `335396c8c0e0fbcb` at 23:07:59;
- `PROGRESS_REPLIES` printed masked: progress stays on;
- `chat.js` served byte-identical to the merged file at 23:08:44 (939,255
  bytes, `dfa07592…`); the other served files unchanged and matching;
- the image window waited once, to 23:25:05.

Full readings: `docs/deploy-record.md`, deploy 2188.

## 3. The free runtime check

The session's one dispatch of *edit canary* (`spend=no`,
`expect_deploy=9d6bda8a`, `expect_image=335396c8c0e0fbcb`, from `main`)
answered **`403 Resource not accessible by integration`** at 23:25:15 UTC. Not
retried, through this client or any other. **The free runtime check, and so the
paid press after it, are the owner's presses** (boxes in the handoff and the
plan's §3). Until the free check reads the merged commit and the image, deploy
2188 is deployed, not runtime-confirmed, and nothing is spent.

**Runtime-confirmed by the owner's free press, run 106** (37703142711, from
`main` at `9d6bda8a`, 23:35:35–23:36:14 UTC): `build-health` and `runtime` both
answered `9d6bda8afc4e`, a cold container `335396c8c0e0fbcb`, async and the
runner on; every zero-cost confirmation passed (the async shape on
`fretwork-1` and `washhouse-3`, a forged replay marker 404, another's job 404,
the free job terminal); `CANARY_SPEND is not 1 — stopping before the paid
edit. Nothing was charged.` Read after it (23:36:32): balance 40, last row
401, no open job. The paid `lv-combined` press is next, the owner's.
