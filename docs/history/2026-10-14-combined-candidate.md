# The combined candidate and its one live verification plan (2026-10-14)

The owner, after accepting the verification fixes at `55e381cc`: *"Move to
preparing the combined candidate with the progress-message work on new.
Fetch both latest heads and combine them in an isolated integration
worktree … Run the combined full suite and site build once … Prepare one
image-free live verification plan … stop before merging into main,
deploying, building the container or spending credits."*

Nothing was merged into `main`, deployed, built, pressed or spent.
`PROGRESS_TALK` stays off. Neither working branch moved for this; only this
record and owner-notes were committed on `claude/help-needed-ehlwlj`.

## 1. The candidate

**Heads fetched:**

| Branch | Head |
|---|---|
| `claude/help-needed-ehlwlj` | `55e381cc` |
| `new` | `9ceca1d4` |
| `main` | `fef80b9b` (production, deploy 2206, image `4444d9d53d906b8d`) |

- Both branches contain `main`, and their merge base is `fef80b9b`.
- `new` has 18 commits that ours lacks; ours has 52 that `new` lacks.

**The candidate is merge commit `4507747c`.**
- Parents: `55e381cc` (first) and `9ceca1d4`.
- It sits on a local branch, `integ/candidate`, in the worktree
  `/home/user/isibi-integ`. It is not pushed.

**Two conflicts, both resolved by keeping both sides:**
- **`Dockerfile`, the job runner's builder COPY line.** Our side adds
  `builder/content-evidence.mjs`; `new` adds `builder/check-evidence.mjs`.
  Both are copied. A check confirmed the merged token set equals the union
  of the two sides.
- **`docs/owner-notes.md`**, two hunks where both branches added sections:
  the current handoff and the dated entries. Both are kept, ours first.
  - No line of ours is lost.
  - The 59 lines of `new`'s copy not carried over are all base-version
    text that our branch had already rewritten.

**Merged without a conflict:** `builder/edit-job.mjs`, `site-render.mjs`,
`site-reply.mjs`, `worker.js`, the canary scripts and their tests. This
matches `new`'s two earlier integration checks (`8d2b4351`, `a295c1e9`).

**No integration fix was needed.** Nothing failed below.

## 2. Verification on `4507747c` (local, once)

**Full unit suite:**
- `10913 / 10913 / 0 / 0`: tests, passed, failed, skipped.
- For comparison: ours alone was `10852 / 10852 / 0 / 0`; `new`'s last
  integration was `10885 / 10883 / 0 / 2`.

**Site build**, run locally step by step in the workflow's order (CI cannot
run on an unpushed commit):

| Step | Result |
|---|---|
| generator tests (`page-gen`, `publish-pages`) | 400 / 400 |
| kit-typecheck | 4 passed |
| kit-render | all passed |
| contrast-cases | 16 passed (see below) |
| kit-a11y | all passed |
| kit-effects | all passed |
| kit-paint | all passed |
| theme-seam | 11 passed |
| theme-render | 29 passed |
| site-routing | 14 passed |
| site-runtime | 47 passed |
| site-build | **404 passed** |

- **The contrast-cases line, said exactly.** Its first local run could not
  start: this machine has no `chromium_headless_shell-1234`. Rerun with the
  installed Chromium (`CHROMIUM_PATH=/opt/pw-browsers/chromium`), it passed
  16 of 16. This was an environment limit, not the code.
- `theme-seam` and `theme-render` logged the same missing headless shell
  for their touch-icon rasterisation, which is a non-fatal warning; both
  passed.
- `site-build` logs one `TS2322` inside the case that compiles a broken page
  on purpose, as recorded before.
- The CI site build on the pushed candidate is still owed before a merge.

**Container image, predicted (not built):**
- **`e386c7a31377e66e`** for `4507747c`, from 207 inputs over 176 paths.
- Controls reproduced: `main` `fef80b9b` gives `4444d9d53d906b8d`
  (production's image), and `new` alone gives `357c5a0ed583d713` (its
  recorded prediction).
- Docs are not image inputs, so record-only commits leave the prediction
  unchanged.

**Rollback, rehearsed in a throwaway worktree:**
- The revert-range rollback (`git revert --no-commit fef80b9b..candidate`)
  does not apply: the range contains this merge commit, and `git revert`
  refuses it.
- The rollback that works with merges is to restore `main`'s tree and
  commit it:
  ```
  git restore --source=fef80b9b --staged --worktree -- .
  git clean -fd
  git commit -m "Roll back to fef80b9b's tree"
  ```
- Rehearsed on `4507747c`: the resulting tree is `6298ed8d…`, exactly
  `fef80b9b`'s. A push of it redeploys `main`'s code and image
  (`4444d9d53d906b8d`).

**`PROGRESS_TALK`:**
- In the candidate the switch is off unless a repository secret of that
  name is set (`deploy.yml`: `secrets.PROGRESS_TALK || 'off'`).
- Nothing in the app reads it back: the runtime route does not report it,
  and this session cannot list secrets. **Its being off rests on the secret
  being unset**, which you can see under Settings → Secrets.

## 3. Getting the candidate to `main` (each step yours)

1. **Publish the candidate.** It descends from `55e381cc`, so it can be
   pushed as the head of `claude/help-needed-ehlwlj`. Because this record
   was committed on that branch afterwards, the candidate is re-made as
   *branch head + `new`*. The resolutions are the same two, and the code
   tree is identical to `4507747c`'s, with only docs added. That push runs
   unit CI and the site build on it.
2. **Pre-merge checks:** nothing in flight, CI green on the pushed
   candidate, the image predicted again, the served files read before.
3. **`IMAGE_PURCHASES` off** for the window of the live run. It stops
   photographs for every customer while off, as before.
4. **Fast-forward `main`:** one deploy, which rolls the container to
   `e386c7a31377e66e`. Wait 15–20 minutes.
5. **Your free runtime press**, with the deploy sha and image boxes filled.
   It must show `jobDesign`, `jobGraph`, `jobBands` and `jobBandsEveryone`
   and the runner fields, or the paid Build press refuses (as it now
   should).
6. **The two paid presses** in §4, then image purchases back on.

## 4. The one live verification (image-free, two presses, one sitting)

### Press A — a first Build (*build as owner*, `check-no-images`)

**Two approval-time commits it needs, to be made on your word:**
- **A fresh slug.** The spec's `saltmarsh-cheese-counter` now exists (run
  117), so "the slug is free" refuses.
- **This mode in `BUILD_BALANCE_OPT_IN`**, at your exact balance. The cap
  is 100 and the balance is 773.

**What it reads:**
- the flags as the container job sees them;
- the build sent once, with an attempt key;
- the Build's progress lines, which are model-written while
  `PROGRESS_REPLIES` is on;
- the trace, bound by the job tag;
- the source, by `?job=`, being the job's own version;
- one page and at most 15 components;
- overlap and order;
- the job's own ledger rows, each taken once.

**Afterwards:** the free `judge-no-images` press on its job id re-reads the
same evidence.

**Cost:** about 11–45 credits (run 117 was 10). The budget is 45.

### Press B — independent Edit and Add-on work with a dependent part (*edit canary*, scenario `acc-mixed`, never pressed)

**The message, on `fold-lane-bakery`:** *"Add a Bulk Orders page explaining
how cafés can order bread in bulk: a minimum order of ten loaves, and
orders in by 2pm for delivery the next morning. Put a link to it in the
menu, and change the Olive & Rosemary's price to £5.90."*

**What it reads:**
- the page by its own words;
- the menu link waiting for the page;
- the price as an independent data part (Olive & Rosemary, 5.80 → 5.90),
  prepared beside the add-on and replayed exactly;
- recorded intervals, for the overlap;
- each part's final reply against its `checks` (`new`'s evidence);
- each publish;
- the press's own charges.

**What it needs:**
- `acc-mixed` in `BALANCE_OPT_IN` (cap 100), an approval-time commit;
- the A4 row check reading 5.80.

**Cost:** about 17–34 credits. The budget is 34.

**Optional, not in the candidate:** reconnect persistence and progress lines
for the Edit/Add-on parts. `acc-mixed` has no closed-tab step and no
progress expectation. Adding `away: "fresh"` and `progress: true` is a small
canary change with tests. If you want it in this same run, it must go into
the candidate before the merge and be reviewed. Without it, reconnect is
read only on the Build (an API reconnect, below).

**Together:** about 28–79 credits. Narration (progress lines and final
replies) is paid by the platform and measured separately
(`scripts/narration-usage.mjs`). Nothing enforces a per-request limit; each
press refuses above its own budget's balance rule, and the account balance
is the hard bound.

## 5. What this run can prove, and what it cannot

**It can prove, if it passes:**

| Aim | Evidence |
|---|---|
| Build parallelism in a live container job | The design graph and/or bands in the trace, its overlap from recorded times, and the flags read as the job sees them. |
| Independent Edit/Add-on work at once | `acc-mixed`'s recorded intervals and its exact reuse of the price preparation. |
| Dependency ordering | The Build's design → database → pages → compile → publish order. The menu link not applied before its page exists. |
| Model-written progress | The Build's lines from real task events. |
| Model-written final replies | Each part's reply judged against what its `checks` say was done. |
| Job/version attribution | The trace tagged by the job. The source read by `?job=` as the version whose manifest names it. Charges by the job's ref. |
| Single publishing and charging | Exactly one stored version per job (the route refuses two). Each ledger ref taken once. The balance move explained by the window. |
| Recovered tracking | Production still waits for the Build's result inside the request, which Cloudflare cuts at about 285 s. A Build of about 7 minutes will lose its answer, so the press will most likely exercise recovery by attempt key: `acceptance: "recovered"`. |

**It cannot prove:**
- **Prompt API acceptance.** Production never answers a long Build within
  the request, so `prompt` acceptance is not expected and is not claimed.
  Recovered tracking is a different fact and is reported as such.
- **Browser reconnect for Edit/Add-on**, unless the optional variant is
  added. The Build's reconnect is an API follow from a fresh sign-in, not a
  browser.
- **`PROGRESS_TALK`.** It stays off, so the talk mode is unexercised.
- **Untagged paths.** A build finished by the resumed-Worker path writes no
  job tag; its trace would read unverified.
- **Photographs.** The run buys none, so nothing about them is shown.
- **Rates.** One sample each; how often the model batches or splits is not
  measured.

**Not repeated:** run 117, K3B, `acc-clarify-resume`, `lv-combined` and
every closed audit.
