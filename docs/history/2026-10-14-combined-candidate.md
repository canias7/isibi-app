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

## 6. The pushed candidate, the executable reconnect and talk checks, the fresh slug (2026-10-14, later)

The owner: *"Finish preparing the combined candidate before requesting
deployment or spending approval. Push it to a separate integration branch …
Include the requested Edit/Add-on reconnect and progress checks in the
executable scenario rather than listing them as optional. Prepare
verification of PROGRESS_TALK itself … Keep the feature off now … don't
assume its live state from an unset-secret fallback … Prepare the fresh
Build slug now while leaving paid opt-ins closed … No merge into main,
deployment, container build, feature activation, paid run or image
generation yet."*

Nothing was merged into `main` (still `fef80b9b`), deployed, built, pressed,
switched on or spent. `PROGRESS_TALK` is unchanged. Both working branches
are unchanged by the candidate: `claude/help-needed-ehlwlj` gained only these
records, and `new` is untouched.

### 6.1 The pushed candidate

| | |
|---|---|
| Branch | **`integ/combined-candidate`** (new; pushed on the owner's word) |
| Head | **`8af536af`**, one commit on top of `1c3eef7f` |
| `1c3eef7f` | the merge of `claude/help-needed-ehlwlj` `44a24b17` (first parent) and `new` `9ceca1d4`. It has the same two conflict resolutions as `4507747c` (§1), and the same code tree plus §1–5's records. |
| `main` | `fef80b9b`, unchanged |
| `new` | `9ceca1d4`, unchanged |
| `claude/help-needed-ehlwlj` | `44a24b17` when the candidate was made; only these records since |

All three heads were fetched again just before the commit and had not moved.

### 6.2 What `8af536af` adds

- **The switch, read live.** `/api/site/runtime` now also answers
  `progressReplies`, `progressTalk`, `jobProgressReplies` and
  `jobProgressTalk`. The first two are the Worker's own reading
  (`progressOn(env)`, `talkOn(env)`); the `job…` two are asked of
  `jobSecrets(env)`, the strings a container job is handed. Before this,
  `PROGRESS_TALK` being off rested only on the secret being unset.
  - The edit canary's preflight line prints `progressTalk=…
    jobProgressTalk=…`.
- **`scripts/canary-talk.mjs`**, the talk press's own checks:
  1. `PROGRESS_TALK` read on, in the Worker and a job, before the message
     is sent. A field the route does not report is cannot-tell, never off
     and never on.
  2. Every part of the request has progress lines.
  3. Every line speaks in the first person.
  4. Each job's lines sit on its own part only. This is checked against
     the part's `ids` and `jobs`.
  5. Within each job, the lines are numbered in order and never earlier in
     time.
  6. Every line seen during the work is still there, word for word, at the
     end. The canary keeps every line as first seen across every view it
     reads (`mergeSeen`), including the reads before the tab was closed. A
     line that vanished, was reworded, or was reworded and then put back
     fails.
  7. Every explanation claims only what its own job's checks hold. The
     claims checked are that it is live, that a browser opened it, and that
     nothing was flagged. Another job's evidence does not count.
  8. Every job's final reply is the model's own (`replySource: "model"`)
     and claims only what its own checks hold.
- **`acc-mixed` now carries the reconnect and progress checks.** On the
  owner's word, these are no longer optional.
  - Its one message is sent, its tab is closed once a progress line shows
    live on a running part, it is read through the requests list alone,
    and then it is followed to its end in a fresh browser session
    (`away: "fresh"`, `expect.progress: true`, judged by the existing
    `progressChecks`).
  - Everything else is unchanged: the page by its words, the menu link
    waiting for the page, the price prepared beside the add-on and replayed
    exactly, the recorded overlap, each publish, the press's own charges,
    and the budget of 34.
- **`acc-mixed-talk`**: the same message, judged on everything `acc-mixed`
  is, plus the eight talk checks.
  - It sends nothing, rehearsal or not, unless the live Worker and a
    container job both report `PROGRESS_TALK` on.
  - It is pressed **instead of** `acc-mixed`, never beside it. One sitting
    has one fixture.
- **The fresh Build slug, `saltmarsh-cheese-lewes`.** It is in
  `BUILD_CHECK_NO_IMAGES` and the *build as owner* form; the brief is
  unchanged.
  - It was read free on 2026-10-14 the press's own ways: no row in
    `site_backends`, `site_builds` or `site_project` (read with
    `select slug` only), and `https://saltmarsh-cheese-lewes.gofarther.app/`
    answered 404.
  - `saltmarsh-cheese-counter` (run 117's site) answers 200 and has rows.
  - The press reads all three again before it sends.
- **Paid opt-ins stay closed:** `BALANCE_OPT_IN = []` and
  `BUILD_BALANCE_OPT_IN = []`, held by a test.

### 6.3 Verification of `8af536af`

- **Tests:**
  - `test/canary-talk.test.mjs`, 22 cases. Each check has its passing
    control beside the failure it must catch:
    - the switch: all on, each one off, each one missing, a string instead
      of a boolean, and an unreadable route;
    - the restore: talk off, or still on in the Worker or the job;
    - a part with no lines, and nothing sent;
    - first person against third person;
    - a line on another part, or on a part that did not file it;
    - numbering reversed at the same time, and a time going back;
    - a line lost, reworded, or reworded and put back, and no line seen;
    - an explanation or a final reply claiming more than its job's checks,
      including when another job's checks would hold it;
    - a final reply that is not the model's, or is missing;
    - both scenario specs, the closed opt-ins, the slug and the form, and
      the verdict adding the checks only when asked;
    - the press reading the switch before its rehearsal stop.
  - `test/publish-integrity.test.mjs`:
    - The roster now carries the four narration fields, all false when
      unset.
    - A new **positive control through the real Worker route**: with
      `PROGRESS_REPLIES=on` and `PROGRESS_TALK=on`, all four read true and
      `talkSwitchVerdict` accepts them. `PROGRESS_TALK=on` alone reads
      talk false. `PROGRESS_TALK=off` passes the restore.
  - The scenario rosters in four existing tests now list `acc-mixed-talk`.
- **Mutation sweep, 33 mutants, from a green baseline:**
  - 31 killed; the 2 comment-only controls survived.
  - The first pass left three alive, and each was examined:
    - **Numbering out of order:** the reversed-lines case was also caught
      by the time check. A same-time case was added.
    - **The between-reads change list:** the reworded case was also caught
      by comparing the final text. A reworded-then-put-back case was added.
    - **`jobProgressTalk` asked of `env` instead of `jobSecrets(env)`:**
      this is equivalent, because `jobSecrets` passes the two names through
      as the same strings. What that field guards is `PROGRESS_TALK`
      staying in `JOB_ENV_NAMES`, so the sweep now drops that name, and
      that mutant is killed by the positive control.
- **Full suite (local):**
  - `10935 / 10935 / 0 / 0` on the tree before those two added cases.
  - On `8af536af` itself: `10936 / 10936 / 0 / 0` on `8af536af` itself (measured; `10935 / 10935 / 0 / 0` on the tree before the two sweep-driven cases).
- **CI on `8af536af`:** green — *unit tests* run 38612760374 (job `test`, `completed`/`success`) and *site build* run 38612760404 (all eight jobs `success`: kit and generator checks, theme checks, published-site checks, `site-build.mjs` shards 1–4, and "all checks"); the per-test counts in their logs could not be read from this session (GitHub serves logs from a host its client does not contact), so only the jobs' own conclusions are claimed.
- **Container image, predicted (not built):**
  - **`e1582f6f71a41dfb`** for `8af536af`, from 207 inputs over 176 paths.
    It moved from `e386c7a31377e66e` because `worker.js` is an input.
  - The `1c3eef7f` control reproduces `e386c7a31377e66e`.
- **Rollback:** the tree-restore method of §2 is unchanged. It restores
  `fef80b9b`'s tree whatever the candidate holds.

### 6.4 The one planned batch (revised; no press, no spend, no switch yet)

**One sitting covers:** Build parallelism, independent Edit/Add-on work,
dependency ordering, model-written progress and replies, the reconnect,
job/version attribution, and single publishing and charging. Inside the
approved test window, the talk checks are added to that same sitting.

**Order of steps. Each is yours to press or set; every one is named so it
can be checked off.**

1. **Before:** your review of `8af536af` (and Codex's), and CI green on it.
   Then the pre-merge checks:
   - nothing in flight;
   - the served files read before;
   - the image predicted again on the candidate as merged.
2. **The approval-time commits, made only on your word:**
   - `check-no-images` in `BUILD_BALANCE_OPT_IN` at your exact balance;
   - `acc-mixed-talk` (or `acc-mixed`) in `BALANCE_OPT_IN`.
   These are the only changes that open spending.
3. **`IMAGE_PURCHASES` off** for the window. As before, it stops
   photographs for every customer while off.
4. **Fast-forward `main`** to the reviewed candidate: one deploy, rolling
   the container to `e1582f6f71a41dfb`. Then wait 15–20 minutes.
5. **Free runtime press** (*edit canary*, spend not yes), with the deploy
   sha and image boxes filled. Its line must read:
   - the new sha and image;
   - `imagePurchases=false`;
   - the job's design, graph and band doors;
   - **`progressTalk=false jobProgressTalk=false`**. This is the first live
     reading of the switch. Until then, "off" is not claimed from the
     fallback.
6. **The talk window, opened.** Set the repository secret `PROGRESS_TALK`
   to `on` (`PROGRESS_REPLIES` must already be `on`). Push nothing; dispatch
   *Deploy to Cloudflare* on `main`, as for deploy 2182. This is the same
   code and the same image (`reused`), so it owes no image wait.
7. **Free runtime press again.** It must read `progressReplies=true
   progressTalk=true jobProgressReplies=true jobProgressTalk=true`.
   Anything else, including a missing field, means stop. The talk press
   would refuse anyway.
8. **Press A:** *build as owner*, mode `check-no-images`, on
   `saltmarsh-cheese-lewes`. While talk is on, its progress lines are the
   conversational ones. The Build check judges them by its own progress
   checks; the eight talk checks are the Edit/Add-on press's.
9. **Press B:** *edit canary*, scenario `acc-mixed-talk`, on
   `fold-lane-bakery`. After the press, its *narration usage* step reads
   the narration calls' tokens, attempts and price back from the Worker's
   log. That is the separately measured narration cost, paid by the
   platform and never by the customer's credits.
10. **The talk window, closed.** Set `PROGRESS_TALK` to `off` (or delete
    it), then dispatch *Deploy to Cloudflare* on `main` again.
11. **Free runtime press.** It must read `progressTalk=false
    jobProgressTalk=false`; `talkSwitchVerdict(rt, false)` is that check.
12. **`IMAGE_PURCHASES` back on**, its own free reading, and the opt-ins
    closed again by a commit.

**If the window is not approved:** steps 6, 7, 10 and 11 drop out, and
Press B is `acc-mixed`. It still carries the reconnect and progress checks;
the talk checks are then not exercised.

**Cost:**
- Press A: about 11–45 credits, budget 45.
- Press B: about 17–34 credits, budget 34.
- Together: about 28–79 credits.
- The redeploys and the runtime presses are free.
- Narration (progress lines, task summaries, explanations, model replies)
  costs the platform, not the customer's credits. It is measured after
  Press B, not estimated here.
- No per-request limit is enforced. Each press refuses above its own
  balance rule, and the account balance is the hard bound.

### 6.5 What this batch still cannot prove

- **Prompt API acceptance of a long Build.** Production still cuts the
  request at about 285 s, so recovered tracking (`acceptance: "recovered"`)
  is expected, and `prompt` is not claimed.
- **Talk on the Build, judged.** The eight talk checks run on Press B only.
  The Build's lines are judged by its own progress checks, and its
  narration cost is not read back by *build as owner*, which has no
  narration-usage step. It could be read from the logs separately.
- **Grounding is held to the job's machine checks only.** A claim about
  the content itself (for example, "the minimum is ten loaves") is not
  held to evidence by the talk checks. The page-content checks cover what
  the page says, not what a progress line says.
- **First person is judged by its pronouns**, a light test. A line can
  pass while still being unhelpful; the words are recorded for you to
  read.
- **One sample.** How often the router splits, how often the model
  batches, and the narration cost per job are not rates.
- **Untagged traces** (the resumed-Worker path writes no job tag) read
  unverified.
- **Photographs:** none are bought, so nothing about them is shown.

**Not repeated:** run 117, K3B, `acc-clarify-resume`, `lv-combined`,
`lv-progress` and every closed audit.

### 6.6 Correction: the talk checks read negation, intent and uncertainty (`e75ff483`)

The owner reproduced three false rejections on `8af536af`'s check.
`ungrounded()` held "I haven't published this yet", "The browser check could
not run" and "I'll run the browser check next" as claims of completion
against evidence that correctly said unpublished, with no browser check.

**The fix, in `scripts/canary-talk.mjs`:**
- `claimsIn` reads each mention in its own clause and gives it a mode:
  affirmed, negated, intended or hedged. The mode comes from the clause's
  own negators, future auxiliaries and hedges.
- A clause with no subject of its own continues the clause before it.
- After a colon or "then", a clause continues an intended or hedged framing
  only. A negation never carries onto a new subject.
- Only affirmed mentions are claims of completion (`claimsOf`), and only
  those are held (`groundingOf`).

**During the work:**
- Every progress line and explanation is held.
- A claim the final checks contradict fails.
- A claim they hold is unverified in time: `talkVerdict` returns it, and
  `requestBatchVerdict` adds it to the press's unverified list.

**Results:**

| Check | Result |
|---|---|
| Red check (the same wordings through `8af536af`'s reader) | 13 of 19 truthful sentences rejected, 1 of 11 false claims missed; now 0 and 0 |
| Sweep | 16 of 16 killed, 2 controls survived |
| Affected tests | 787 / 787 |
| Full suite (local) | `10945 / 10945 / 0 / 0` |
| Unit CI, run 38624052804 | `10945 / 10901 / 0 / 44` |

- The site build was not triggered (path filter). Its inputs have not
  changed since `8af536af`, where it passed.
- The image prediction is still `e1582f6f71a41dfb`.
