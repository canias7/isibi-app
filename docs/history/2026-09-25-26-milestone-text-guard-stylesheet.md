# Edit-path history, 2026-09-25 to 09-26: the milestone, the text guard and the stylesheet corrections

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). In order: deploy
> 2155's merge record; the edit-path milestone and the literal-text guard
> (deploy 2158); the ledger refusal wording (2159); run 32; the text guard
> holding page qualifiers and refusing quoted or unreadable page operands; the
> consolidated edit-path milestone and the rollback round (2160); the
> stylesheet check scoped to the request, the failed restore always said, a
> rule's quoted values and escapes, and a comment as a token boundary (2161).
>
> The section on the canary's after-read wait, which sat between run 32 and the
> text-guard rounds, is in `docs/instruments.md`. What is still law from these
> rounds is summarised in CLAUDE.md.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at its other sections.

### MERGED AND DEPLOYED: THE EDIT REPLY, LATCH AND RESULT CORRECTIONS (2026-09-25)

Owner: *"The correction passes independent review on 5afd5a0: 571 focused
tests, all green. … Merge and deploy the reviewed edit-response validation,
handoff-lock and result-display corrections after confirming the candidate and
required CI remain current. Verify the actual deployed SHA and served chat.js
against the merged file. Recompute the container input hash and confirm reuse
or a roll from the deployment log. No paid replay."* The three sections above
go out as one push.

- **RECHECKED BEFORE THE PUSH, AND NOTHING HAD MOVED**: a clean tree;
  `origin/main` still `fd27cc9f`; the candidate `5afd5a0f` the branch tip and a
  fast-forward of main; the range **7 commits, 16 files (+2,942 / −113)** —
  `public/chat.js`, `scripts/addon-sweep.mjs`, twelve test files and the two
  documents; unit CI green on every commit of it (`8921c0ec` `36063913439`,
  `88f9d564` `36064397030`, `4b849501` `36064986189`, `c3963607`
  `36070847167`, `ce27b5bb` `36071187172`, `86e8893f` `36079630725`,
  `5afd5a0f` `36079909541`); zero runs in progress, queued or waiting.
- **NO `site build` WAS OWED**: its `paths` list re-derived from the workflow
  file as it stands (21 patterns) and matched with GitHub's own rule, the
  matcher proved alive first (`worker.js` matches, `scripts/x.mjs` does not) —
  none of the sixteen.
- **REUSE PREDICTED FROM THE INPUTS**: both ends answered `56f7d5866240a1de`
  from 186 inputs, and none of the sixteen files is among the **156 distinct
  input paths** (30 files are COPYed to two destinations, so 186 counts
  entries); the observer proved alive (`worker.js` and `builder/page-keep.mjs`
  are inputs).
- **THE ROLLBACK, VERIFIED BEFORE IT COULD BE NEEDED**: `git revert --no-commit
  fd27cc9f..5afd5a0f` in a throwaway worktree gives tree **`bb60fd93…`, main's
  own**, so a rollback also reuses `56f7d5866240a1de`.
- **A FAST-FORWARD**: `main` `fd27cc9f` → **`5afd5a0f`** at **01:22:25Z**.
- **DEPLOY 2155 (`36081725007`)**: success, job 01:22:30 → 01:23:22Z (**52 s**,
  read off the job's own top-level fields). `DEPLOY_ID`
  `5afd5a0fe5***e2d5f9bb6480c649cd857e2c20668` (the `***` a masked `1`, so the
  candidate `5afd5a0fe51e2d5f…`); the deploy gate *"took over from
  `fd27cc9f…`"*; image step **~1.4 s** — `reused
  isibi-app-sitebuildcontainer:56f7d5866240a***de (registry answered 200;
  ***86 inputs off ./Dockerfile)`; Wrangler **~18 s** (it reinstalled itself
  first) — `+ /chat.js`, 1 uploaded, 85 already, `Uploaded isibi-app`, **`no
  changes isibi-app-sitebuildcontainer`**, `Deployed isibi-app triggers`,
  `Current Version ID: 2aa***a3***5-…`. **No hold was owed**: nothing rolled,
  and the edit jobs keep running on the image deploy 2151 put there.
- **THE SERVED-FILE CHECK, BOTH READINGS**: before (01:22:12Z, before the push)
  **770,384 bytes, sha256 `489b2884eab21157`**, byte-identical to `fd27cc9f`'s
  `chat.js`, 0 occurrences of `editShownMsg`, `editAskDone`, `readEditReply` or
  `readRouteReply`; after (01:23:54Z) **781,431 bytes, sha256
  `974b455ab0135e1d`, byte-identical to `git show 5afd5a0f:public/chat.js`**
  with and without a query string, 2, 5, 6 and 3 of them. Gates **401 / 401 /
  401 / 404** at 01:23:54Z.
- **DEPLOYED, NOT RUNTIME-CONFIRMED.** The canary dispatch answered **403**
  again at ~01:24Z, so the Worker's own sha is the owner's free press:
  `edit-canary.yml` from `main`, spend `no`, `expect_deploy`
  **`5afd5a0fe51e2d5f9bb6480c649cd857e2c20668`**, `expect_image`
  **`56f7d5866240a1de`**. The product change is the served file, and that
  reading was taken directly; the press confirms the Worker version beside it.
- **THE LIMITATIONS TRAVEL WITH IT, EACH ITS OWN ITEM** (owner: *"Keep the
  recorded limitations explicit"*):
  1. **drafts are session-only** — they survive navigation and redraws within
     the session, never a browser refresh;
  2. **a failed balance refresh can prevent the preview refresh** — both
     appliers refresh the credit balance FIRST, so a throw there is kept as a
     known result but skips the preview bump, the picker update and the undo
     record, and the preview may show the old bundle until the next bump (the
     add-on's order, kept as asked);
  3. **console-only errors** — a QUEUED non-success sentence whose redraw
     throws after it is out still escapes the watcher as an unhandled
     rejection (one sentence, the page freed, the latch released), as the
     add-on's queued refusal does, and the add-on's known-result sentence is
     not guarded against its own redraw failing;
  4. **the queued one-hop limit** (next-task 12) — unenforced on the queued
     path, unreachable today because no hop target has a hop of its own.

  None is closed by this deploy. **Every answer in the evidence is SUPPLIED**:
  what is established is what the browser sends, says and holds. **Items 2–4
  are since closed in code and controlled tests** — 3's add-on half at deploy
  2157, the rest at deploy 2158, next section — and item 1 is by design.

### MERGED AND DEPLOYED: THE EDIT-PATH MILESTONE AND THE LITERAL-TEXT GUARD (2026-09-25)

Owner: *"The implementation is approved for merge and deployment … Verify the
actual deployed SHA, served browser files and container image after rollout
using existing non-spending checks … Preservation is limited to the documented
literal-text scope and supported request grammar; do not claim universal
preservation or proven real-model compliance."* The candidate was Codex's
`codex/edit-text-preservation` at **`6ed355e495f9ba404d7556aa8148831d5fcd2bcd`**,
carrying the reviewed `codex/edit-path-milestone` rounds under it; what each
fix is and what bounds it are in `docs/investigations/edit-path-milestone.md`
and `edit-text-preservation.md`, deliberately not copied here.

- **NOT MERGED OR DEPLOYED BY ANYONE ELSE, ASKED**: `origin/main` was
  `38fe281d` (the owner's last verified main), the candidate was not its
  ancestor, and the last deploy run was 2157 at `a5741864` — main's two later
  commits touch `docs/` alone, so they deployed nothing.
- **A FAST-FORWARD**: `38fe281d` is an ancestor of the candidate and main held
  0 commits the candidate lacked, so every main commit is kept by
  construction. Pushed **14:37:00Z**, 9 commits, 23 files (+997 / −82).
- **RECHECKED BEFORE THE PUSH**: unit run **`36109568312` on `6ed355e4`** at
  **`# tests 7827 / # pass 7823 / # fail 0 / # skipped 4`** (`duration_ms
  131,861`), and `site build` run **`36109568288`** on the same sha, job and
  all twenty steps `success` (07:48:53 → 08:14:19Z) — read by the job's own
  fields, and its counts not re-read, the review being the owner's and
  closed. Zero runs in progress, queued or waiting.
- **THE ROLLBACK, VERIFIED BEFORE IT COULD BE NEEDED**: `git revert
  --no-commit 38fe281d..6ed355e4` in a throwaway worktree gives tree
  **`195d1801…`, main's own**, so a rollback's image step says `reused
  b83b0611aeecce8f`.
- **DEPLOY 2158 (`36148674316`)**: success, job 14:37:06 → 14:40:15Z.
  `DEPLOY_ID` `6ed355e495f9ba404d7556aa8***4883***d5fcd2bcd` (each `***` a masked
  `1`); the gate *"took over from `a5741864…`"*; image **built and rolled**
  (the paragraph in the deploy section above); drain `no live leases after
  0s`; `+ /edit-poll.js`, `+ /chat.js`, 2 uploaded, 84 already; `Uploaded
  isibi-app`, `Current Version ID: 906fdee6-5***8c-…`, `Deployed isibi-app
  triggers`. **The image rolled, so the 15–20 minute hold is owed** before
  container work that must run the new code.
- **THE SERVED-FILE CHECK, BOTH READINGS**: before (14:36:29Z) `chat.js`
  **781,511 bytes, `d873ddb00e7375f7`** and `edit-poll.js` **29,272 bytes,
  `6de38f0c05eb0e51`**, each byte-identical to `38fe281d`'s; after (14:40:52Z)
  **781,931 bytes, `36b2d3b6dc15f271`** and **29,391 bytes,
  `7d7da74ed3b3c160`**, each **byte-identical to `git show 6ed355e4:public/…`**
  with and without a query string. Discriminators 0 → N: `finishOnce` 0 → 2
  and `rec.handedOff` 0 → 1 in `chat.js`, `handedOff === true` 0 → 2 in
  `edit-poll.js`. A background poll saw the new `chat.js` first at 14:40:09Z,
  the second Wrangler finished. Gates **401 / 401 / 401 / 404** at 14:40:52Z.
- **RUNTIME-CONFIRMED BY THE OWNER'S FREE PRESS, run 30
  (`36155364708`, 15:36:57 → 15:37:34Z)**. The session's own dispatch,
  re-tested at 14:56Z once the hold had passed, answered **403** again, so the
  press was the owner's. The env block reads `CANARY_SPEND: 0`, a blank
  instruction and read_job, and both expectations set.
  - `build-health 200 deploy=6ed355e495f9 image=f05cb5a5a0def44c` and
    `runtime 200 deploy=6ed355e495f9 async=true runner=true`, with the
    control `washhouse-3 async=true`.
  - Every preflight check is `ok`: both readers answered and agree, async and
    runner are true, the Worker is the expected build, and a cold container
    gets the expected image.
  - The zero-cost confirmations pass: both sites get the ASYNC shape, a
    forged replay and a stranger's poll answer 404, and the free job settled
    in ~6 s as `{"ok":false,"escalate":true,"reason":"empty","cost":0}`.
  - `ALL FREE CHECKS PASSED`. The source read was complete (`fretwork-1`:
    `index.tsx` 26,563 b, run 26's page), and the balance was **3**, as at
    canary 28.
  - It ended with *"CANARY_SPEND is not 1 — stopping before the paid edit.
    Nothing was charged."*
  - **⚠ Run 29 (`36155104292`) two minutes earlier is NOT evidence.** The
    form's values landed in the wrong boxes: the sha went into `instruction`
    and the image into `read_job`, with both expectations blank. So it ran the
    read-only job lookup, found no job `f05cb5a5a0def44c`, and exited 1 above
    the preflight. It spent nothing and changed nothing.
  - **The GitHub form shows descriptions, not input names**, so a pair of
    values handed over for pasting should name the boxes by their descriptions.
- **THE LIMITS TRAVEL WITH IT**: the guard compares parsed literal JSX prose
  per section on the full EDIT page writer alone — not computed or data-driven
  words, not a component's prop strings, not other component files, not CSS
  content — and authorises only its supported grammar (an explicit operation
  on an exact unique heading or section id, or quoted exact text), so
  legitimate phrasing outside it can be refused. **Every writer answer in its
  evidence is SUPPLIED**: it proves the route refuses an unauthorised loss of
  that prose and publishes an authorised one, never that a real model follows
  the request. The two live tests the milestone plans are prepared and not
  dispatched (13–26 credits together; balance 3 at canary 36096052737).

### A LEDGER REFUSAL STATES THE EDIT'S CHARGE AND THE ROUTING CHARGE APART (2026-09-25, merged and deployed in deploy 2159)

Owner, after canary run 31 (`36159773928`) stopped at the credit reservation:
*"compileMsg's unbilled response says "nothing was charged," although routing
already charged 2 credits. Distinguish the edit's charge from routing. Use
actual recorded amounts where available; if routing cost is unavailable after
reload, don't invent a total or claim the whole request was free. Keep "not
published" separate from "nothing changed.""* **Merged and deployed in deploy
2159 (the last bullet); no paid run.**

- **REPRODUCED FIRST THROUGH THE REAL COMPOSER.** `editBrowserReply` was run
  over run 31's stored reply and its own routing reply, both read from the
  artifact. The screen said *"⚠️ …so it wasn't published and nothing was
  charged. Top up and send it again."* The routing call's 2 credits (balance
  3 → 1) were never mentioned. The billing-service-down sentence and a resumed
  watch read the same way, with `actions: []` in all three.
- **THE SERVER SAYS WHAT HAPPENED; THE READER STATES THE MONEY.**
  - `compileMsg`'s two `unbilled` sentences now end at *"so it wasn't
    published"* plus their advice. They make no claim about money.
  - `wholeRequestNote` gains an `unbilled` branch. It states the edit's own cost
    from the reply's `cost`, **but only when that is a real non-negative
    number**: *"This edit cost you nothing."* or *"This edit cost N credits."*
    Anything else says nothing about the edit rather than calling it free.
  - It then states the routing reply's `cost` when the page holds it: *"Reading
    your message cost 2 credits."* This is the same clause the
    `unchanged`/`withheld` branch uses, now computed once.
  - A watch resumed after a refresh holds no routing reply. So it gives no
    routing amount and no total, and *"this edit"* stays the subject.
- **NEVER "NOTHING ON YOUR SITE CHANGED" ON THIS BRANCH.** A rung can write
  rows before the reserve that refused (the comment `compileMsg` already
  carried), so only "not published" is claimed. The `unchanged`/`withheld`
  branch's output is byte-identical; a dozen guards pin it.
- **WHAT THE CUSTOMER SEES:**
  - Short balance: *"⚠️ That didn't go through — there aren't enough credits
    for it, so it wasn't published. Top up and send it again. This edit cost
    you nothing. Reading your message cost 2 credits."*
  - Billing service down: *"…our billing service didn't answer, so it wasn't
    published. Try again in a moment."* followed by the same two amounts.
  - Resumed after a refresh: the first sentence and *"This edit cost you
    nothing."* only.
- **THE ADD-ON SHARES THE SENTENCE AND NOT THE READER.** Its `unbilled`
  publish failure answers `error: "compile"` with `compileMsg`'s text. So its
  screen now reads *"…so it wasn't published. Top up and send it again."* with
  no money line. `addonAnswer` is unchanged.
- **⚠ A ROLLOUT WINDOW, STATED.** A container still on the previous image
  composes the OLD sentence, and the new browser then adds the money line. So,
  until the rollout's container change completes, a screen can read *"…nothing
  was charged. … Reading your message cost 2 credits."* This happens only when
  an `unbilled` refusal lands inside that window.
- **UNCHANGED:** the rest of next-task 4, including `compileMsg`'s other
  branches and the other unscoped "nothing was charged" sentences.
- **EVIDENCE.**
  - **Tests.** `test/edit-reserve-refused.test.mjs` goes from 15 to 17 cases.
    - Four existing route cases gained the screen check (`assertScreens`). They
      are the job path and the synchronous path, each with a short balance and
      with the billing service down. The check composes the stored reply on the
      page that sent it and after a refresh. It requires `actions` to be `[]`,
      and the screen must never say "nothing was charged" or "Nothing on your
      site changed".
    - The two new cases are run 31's recorded reply with its own routing reply,
      and a recorded-amounts boundary: routing cost 1, an edit cost that is
      missing, and an edit cost of 3.
    - The guard that pinned *"wasn't published and nothing was charged"* is
      re-anchored to the property.
  - **Red: 6 of 17 fail on the unfixed code**, and the same 6 fail with only
    the server or only the browser fixed.
  - **Probes** (`scripts/mutants/unbilled-wording.json`): **8 killed, 0
    survived, 0 never applied, the comment-only control surviving.** They ran
    over the 17 files that read these sentences (baseline 703/703), and both
    swept files were byte-identical afterwards.
  - **Local suite:** 7,829 tests (`7829 / 7827 / 0 / 2`), +2 against main's
    7,827.
  - **CI unit run `36162058190` on `eb7a4372`:** `7829 / 7825 / 0 / 4`,
    `duration_ms` 126,774. All six changed cases pass by name, there are 7,829
    distinct result numbers, and there are zero `not ok` lines.
  - **`site build` run `36162058201` on `eb7a4372`** (16:38:41 → 17:04:24Z,
    **25m43s**, all twenty steps green) read all twelve counts green out of
    the step log:
    - TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
      theme-seam 11, theme-render 29, site-routing 14, site-runtime 47;
    - kit-render, kit-a11y, kit-effects and kit-paint `all passed`;
    - census 7 + 4 + 1 = **12**.

    The only `##[error]` lines are the two known annotations
    (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) from the case that
    compiles a broken page on purpose. `site-build.mjs` took **18m53s**.
    **The stamp chain ends at `eb7a4372`.**
- **MERGED AND DEPLOYED — deploy 2159 (`36169277205`), RUNTIME-CONFIRMED BY
  CANARY RUN 32** (owner: *"Merge and deploy this reviewed correction… No paid verification run
  is needed for this wording fix."*). The independent review passed 26 focused
  tests and both required CI checks.
  - **A fast-forward**: main `6ed355e4` → **`c2fa000c`** at 17:46:57Z, 9
    commits, 6 files. Main had not moved, so nothing on it could be lost.
    Asked before the push: nothing in flight, CI green on every commit of the
    range, the image predicted over both ends, and the rollback verified —
    reverting the range gives tree `2c1475c6…`, main's own, so a rollback
    reuses `f05cb5a5a0def44c`.
  - **The deploy**: job 17:47:04 → 17:50:13Z. `DEPLOY_ID` `c2fa000c…`; the gate
    took over from `6ed355e4…`; the image **built `a51d8b32e5869576` and rolled
    from `f05cb5a5a0def44c`** (the paragraph in the deploy section); `+ /chat.js`,
    1 uploaded, 85 already; `Uploaded isibi-app`, `Current Version ID:
    d9568430-…`, `Deployed isibi-app triggers`.
  - **The served file, both readings**: before (17:46:21Z) 781,931 bytes,
    sha256 `36b2d3b6dc15f271`, byte-identical to `6ed355e4`'s, 0 ×
    `if (e.error === 'unbilled') {`; after (17:51:24Z) **782,960 bytes,
    `d5b10edb5534dae5`, byte-identical to `git show c2fa000c:public/chat.js`**
    with and without a query string, 1 ×. Gates 401 / 401 / 401 / 404.
  - **The Worker half was Wrangler's report until run 32.** The server
    sentences live in `worker.js`, and the Worker's sha and a cold start's
    image need a signed-in read. Canary run 32's preflight (18:15 UTC) read
    `build-health 200 deploy=c2fa000cba21 image=a51d8b32e5869576` and `runtime
    200 deploy=c2fa000cba21 async=true runner=true`, both readers agreeing and
    both form expectations matched.

### RUN 32 — THE SECTION MOVE PUBLISHED AS A PURE BLOCK MOVE, AND THE HARNESS READ THE OLD PAGE (2026-09-25)

Live test 2, with the owner's spending approval: `36172189711`, dispatched
18:14:49Z from `main` at `c2fa000c`; job 18:14:53 → 18:22:55Z. The request is the
sheet's, byte for byte: 131 chars, sha256 `b9271234b92233a3…`, `source:
CANARY_INSTRUCTION`. **It counts as the test**:
- its own before-read (18:15:27Z, `reads` all true) matched all six recorded
  starting hashes (`index.tsx` `8041046d0e4aba77` and the five below);
- the preflight passed with both expectations set;
- it published.

- **Routing.** The router was given `/, /prices, /gear` and answered `intent=edit
  layer=page page=/` in 20.3 s, cost 2 (`7,286 in / 19 out`).
- **The job.** `bb3e792f1eb4142103be22c9ebe6748c`, created 18:15:56.66Z.
  - States: `claimed` to ~95 s after the POST, `routing` (cost 8) from ~109 s,
    `publishing` at ~408 s.
  - A stored 200 under `x-gf-edit: final` at 414.4 s (127 polls, 0 transient).
- **THE QUICK WRITER PUBLISHED** (`tweak: true`). One billed call, `grok-4.6`
  `8,374 in / 7,688 out / 512 cache read`: it re-emitted the whole page, like
  run 17's `8,314 / 7,627`.
  - The live version moved `01790155568567-c1td33` → **`01790360265159-n7mtnq`**,
    minted 18:17:45.159Z (2 s after the reserve).
  - Job `published_at` 18:22:45.03Z, `worker_status` 200.
  - `phase_ms`: `publish:1` 305,014, `stage` 30,674, `activate` 8,055,
    `worker:put` 1,675.
  - `moved: []` and `changed: []` on the reply are the recorded tweak-reply
    shape (neither key is set), not an inventory.
- **A PURE BLOCK MOVE, measured on the stored bodies.**
  - `index.tsx` `8041046d0e4aba77` → `6bb1fb500f7df623`, still 26,563 chars.
  - Its 14 top-level render blocks (13 sections + the QR slot, which draws
    nothing here) are each byte-identical. The chords block went from 9th to
    2nd, directly above the guitar block, and the title is still first.
  - The 16,554 chars above the render are byte-identical, and the token and
    line multisets are identical.
  - The other five bodies are byte-identical: `prices.tsx`, `gear.tsx`,
    `chord-diagram`, `trial-booking-form`, `day-space-lookup`.
  - The evaluator was proved alive first on two synthetic afters: a pure move
    read as exactly that, and a move plus one changed block was flagged.
- **MONEY CLOSES EXACTLY: 101 → 91 = route 2 + edit 8**, balance read by the
  canary at both ends.
  - `credit_events` holds ONE row for the job: `reserve −8, balance_after 91,
    ref <job>#1`, 18:17:43Z. There is no refund.
  - The job reads `done`, `billing: finalized`, `cost 8`.
  - The routing charge writes no ledger row, as recorded. The reserve's
    `after 91` puts the balance at 99 just before it.
- **THE REPLY**: *"✅ Updated /. I had a look at the finished pages: / threw an
  error and 2 pages reads something the check can't reach, so I couldn't see it
  with real data."*
  - The render findings are `/` [phone] #418 (the known unresolved finding),
    `/` `unmet` (a database function) and `/prices` `unmet` (an outside
    connection). `deadSelectors` are the same two as before.
  - `langs` fr/es are `cached`, `missing: 0`.
- **⚠ THE HARNESS'S AFTER-PAGE WAS THE PREVIOUS BUILD, SO `compare.json` SAYS
  NOTHING MOVED.**
  - The after-inventory (18:22:53Z) read the NEW source out of the store, but
    its `route_home.html` was rendered at 18:22:52.946Z by the OLD script. That
    was 7.9 s after `published_at`.
  - That page carries the old route chunks (`index-Dbwawyy9.js`,
    `index-CKn4l9II.js`) and is byte-identical to the before-read once the
    render timestamps are masked. So every route read `orderChanged: false`
    and `/` read 477 → 477 words.
  - A curl 61 s after the publish got `n7mtnq` and the new chunks
    (`index-Czmz-jMb.js`, `index-DE311wwR.js`).
  - **The cause of the 7.9 s is not measured**; what is measured is the two
    reads.
  - **The paid path's after-read does not wait for `x-site-version` to move,
    and the restore mode does.** A stale read compares the old page against
    itself, so it would hide a real loss exactly as it hid this real change.
    **Fixed on the branch the same evening** (the next section but one).
- **THE LIVE PAGES, read independently at 18:23:54Z and 18:25:55Z, every route
  on `n7mtnq`.**
  - `/` headings: Book a guitar lesson · The first eight chords · A guitar you
    can turn · September 2026 · Space on a preferred day · Book a trial lesson
    · Book a trial lesson.
  - `/`: visible words 509 → 509 as a multiset (the before-read through the
    same reader), `data-slot` census identical (52), forms 4, svg 9, canvas 1,
    inputs 12, buttons 15, links 12.
  - `/prices` and `/gear`: headings, word multisets and slot censuses
    identical.
  - `/fr` and `/es` carry the move too.
- **What it established.** One real model, given this sentence on this site,
  moved one section as asked. The route published exactly that, billed it once,
  and said so. **CLOSED FOR EXACTLY THAT (owner, 2026-09-25)**: the quick
  writer moved the section while preserving the surrounding source. The move
  stays live; nothing was restored.
- **What it did not establish.**
  - The full writer never ran, so **the literal-text guard (full writer only)
    was not exercised**.
  - One billed call means `keepCheck` found nothing lost; it calls its judge
    only on a loss.
  - The writer's prompt is not captured, and there was no second message.
  - #418 is not resolved by any of it.
- **THE BROWSER CHECK (item 8), FREE AND READ-ONLY, 19:00Z on `n7mtnq`.**
  - **How, since Chromium cannot open the site directly here:** `page.goto`
    answers `net::ERR_CERT_AUTHORITY_INVALID`. So every request the page made
    was fulfilled (`context.route` → `route.fulfill`) from a Node fetch through
    the session proxy, with TLS verified against `/root/.ccr/ca-bundle.crt`. No
    trust store was changed and no verification was disabled. The bytes and
    scripts are the live site's; Chromium's own network stack was not
    exercised. The trap entry has the details.
  - **Order**: headings `Book a guitar lesson · The first eight chords · A
    guitar you can turn · September 2026 · Space on a preferred day · Book a
    trial lesson · Book a trial lesson`. Nothing sits between chords and
    guitar in the DOM, and the chords heading is drawn 748 px above the
    guitar's. There are 8 chord diagrams at 160×215.
  - **The guitar**: the canvas is 1096×420 with a live WebGL 2 context. Its
    screenshot has 26 quantized colours and 8.2% non-background pixels, and a
    240 px drag changed 2.4% of its pixels (it turns).
  - **Availability against the REAL `bookings_on_day`**, 6 calls, all 200:
    - The load call with an empty day answered `0`, and the box read "Choose a
      day to check space."
    - **2026-09-17 → `1`** → "5 places left." (a real booking; the
      `bookings_public` read listed that day).
    - 2026-09-25, 2026-09-26, 2026-10-02 and 2027-03-15 → `0` → "Six places
      left."
    - So "Six places left." appeared exactly when the real answer was 0.
  - The page reached two hosts, the site and `static.cloudflareinsights.com`.
    There were no console errors, no page errors and no failed requests.
  - **Noticed, pre-existing, parked with translation**: the page carries
    `lang="cy"` and its switcher labels the English home page "Cymraeg". Run
    30's and run 32's before-reads carry the same.

### THE TEXT GUARD HOLDS A PAGE QUALIFIER TO THE EDITED PAGE (2026-09-25, `ce913d06` + `8c0d67a1`, merged and deployed in deploy 2160)

Owner, having reproduced both with correct generated output: *"Customers
should not need a specially shortened sentence to get a valid edit accepted.
Support these page-qualified requests while retaining exact target boundaries.
A page qualifier must match the actual target page; it must not authorize
unrelated sections or turn a referenced section into another removal
target."* The sentences were *"Remove the ‘The first eight chords’ section from
the home page."* and *"On the home page, change the text under ‘The first eight
chords’ to ‘Start here.’"*

- **THE CAUSE**: the qualifier was read as part of the target operand, which
  then matched no section (`from` is not an operand boundary), and a leading
  qualifier kept the verb from opening the clause. *"The text under X"* was not
  a form at all.
- **THE FIX, in `builder/page-prose.mjs`**:
  - `preservePageProse` takes `page`, and the edit route passes
    `routeOf(target.path)`.
  - `PAGE_QUAL` finds each qualifier: on/in/from/off/of/for/at plus the home
    page (or homepage, front, main, landing, index page), an address, "`<word>`
    page", or this/the page. **Not "to"**: it already ends the target operand,
    and a page after it is a destination or replacement wording, so reading it
    as a qualifier could only refuse a valid request (Q-14).
  - `samePage` holds each one to the edited route. A home synonym is `/` only,
    an address is compared, and "`<word>` page" is the route whose last
    segment is `<word>`. This/the page always matches. **An unknown page
    confirms nothing.**
  - **Any unconfirmed qualifier voids the clause's grant.**
  - `PAGE_LEAD` strips a leading qualifier, and qualifiers are cut out of the
    operand before `resolve`.
  - "text"/"words" under/in/of X join the line-scope forms (exactly one
    paragraph or no grant).
  - The quoted-text replacement is read with qualifiers removed.
- **WHAT CANNOT HAPPEN, EACH A CASE**:
  - A qualifier never becomes a target.
  - A reference after it stays a reference (*"…from the home page above ‘A
    guitar you can turn’"* dropping both is refused).
  - "From ‘<section>’" is not a page and grants nothing.
  - A qualifier naming another page grants nothing, leading or trailing.
  - A qualifier can only narrow a grant.
- **EVIDENCE.**
  - `test/edit-page-keep.test.mjs` gains **23 cases**: 22 through the real
    route (sync and job) plus the matcher case.
    - Publish: the owner's two sentences, the reference, and quoted text with
      a qualifier.
    - Refuse on `prose-preservation`/`unconfirmed-target`, with 0 compiles, the
      store unchanged and no reservation: unrelated loss beside each sentence,
      the heading renamed too, another page named (trailing and leading), the
      reference dropped too, and "from" a section.
  - **Red on the unfixed guard: exactly the 6 publish cases and the matcher
    case**. The 14 refusals and all **156 existing cases** (the
    ambiguous-target, quoted-text and collateral controls among them) pass on
    both.
  - **Probes `scripts/mutants/page-qualifier.json`: 14 killed, 0 survived, 2
    comment-only controls**. The first pass left **Q-13 surviving** (an
    address recognised but not compared), a real fixture gap closed by a
    negative case.
  - Suite **7,863 locally** (`7863 / 7861 / 0 / 2`, +23).
  - Checked separately on fretwork-1's stored `n7mtnq` home page, with the
    real guard and supplied answers (17 cases): the same outcomes.
- **LIMITS**: a page named by its navigation label (*"the Lesson Prices page"*)
  is not confirmed and grants nothing. Unquoted replacement words naming
  another page void their clause. Both are conservative, never wider.
  **⚠ THE FIRST HALF WAS TRUE AFTER from/in/of/for AND FALSE AFTER on/at/off**,
  where the page was dropped unread and the removal granted. See the next
  section, which also closes the quoted-address bypass the owner found.
- **AN IMAGE INPUT**: the predicted id at `8c0d67a1` is `18725c075657d7e3`
  (187 inputs), against main's `a51d8b32e5869576`. `72885ca9` alone moves
  nothing.

### A QUOTED OR UNREADABLE PAGE OPERAND GRANTS NOTHING (2026-09-25, `d6f5e55e`, merged and deployed in deploy 2160)

Owner, on `db5babc`: *"“Remove the ‘Chords’ section on /menu.” correctly
refuses. “Remove the ‘Chords’ section on ‘/menu’.” incorrectly accepts. Quote
shielding hides the page operand from PAGE_QUAL, while the later “on” split
still authorizes the section removal. Recognize quoted page identifiers in the
page-qualifier position without treating quoted replacement copy as
instructions. Keep page validation tied to the actual edited route.
Unrecognized or ambiguous page operands must not silently disappear."*

- **THE GAP WAS WIDER THAN THE QUOTE.** `PAGE_QUAL` knew only a fixed set of
  page names. Whatever else stood after on/at/off was cut off by the operand
  split and never read. Reproduced on `db5babc` with supplied answers, each
  published on `/`:
  - a quoted address or name (‘/menu’, ‘Gear Board’);
  - a page in several words (*"the Lesson Prices page"*) or a plural (*"the
    home and menu pages"*);
  - an address the pattern did not spell (`/café`) and a web address;
  - *"that page"*, pointing back at a page another clause named.
  After from/in/of/for the same operands refused, but only because the
  leftovers stopped the target resolving. So a MATCHING ‘/’ or ‘the home page’
  refused as well, and the previous section's limit was half false.
- **THE FIX, in `builder/page-prose.mjs`**:
  - `pageQualifiers` replaces `PAGE_QUAL`/`PAGE_LEAD`. After a page
    preposition it lists every page operand, with where it stands and whether
    `samePage` confirms it.
  - A page operand is a quote standing in that position, an address, a web
    address, or words ending in "page(s)". A name never runs across another
    preposition (`QUAL_STOP`).
  - A quote is read only there. If it is not recognisably a page it is
    ambiguous and grants nothing, except after a form's own in/of (*"the words
    in ‘Hours’"*).
  - Quoted replacement copy is never scanned. Unquoted new wording is still
    the sentence, as before.
  - *"That page"* is never confirmed.
  - The lead is cut when the first qualifier opens the clause. `unqualified`
    removes the confirmed spans from the operand and from the replacement.
- **EVIDENCE.**
  - `test/edit-page-keep.test.mjs` gains **9 cases**. Eight go through the real
    route (sync and job):
    - the owner's wrong-page quoted address, refused;
    - **the same sentence edited on `/menu`, published**, the matching-page
      control;
    - a matching quoted page beside an unrelated loss, refused;
    - quoted replacement copy naming another page, published.

    The ninth is a module case over every operand shape, in all four quote
    styles.
  - `drive` gained `target`, so a case can edit a page other than the home
    page, and 179 existing cases passed unchanged with it.
  - **Red on `db5babc`: exactly 3 of 188.** These are the wrong-page case on both
    paths (it published, 200, cost 3) and the module case. The six controls
    pass on both.
  - A 45-sentence local matrix differs from `db5babc` on exactly 13 sentences:
    9 bypasses closed and 4 matching quoted pages now accepted.
  - **Probes `scripts/mutants/page-qualifier.json`: 30 killed, 0 survived, 0
    never applied, 3 comment-only controls**, over the 11 edit-path files
    (baseline 368/368). Both probed files were byte-identical afterwards. The
    anchors are rewritten for the new reader: Q-1 to Q-14 keep their meaning,
    and Q-15 to Q-30 are one per load-bearing clause.
    - Q-15 restores the reported bypass, generalised.
    - Q-18 and Q-19 needed a page operand after the target's own end (*"…at
      the top in ‘Gear Board’"*, *"…like the text on ‘Gear Board’"*) before
      they could die.
    - Two belts were removed first rather than left to survive: a web-address
      null that `samePage` already produces, and a `same` test inside
      `unqualified`, which runs only after every qualifier is confirmed.
    - ⚠ **The `pgrep -f` waiter trap, met again.** The wait on the run
      matched its own command line. The run's own completion notice arrived
      first, and the waiter was killed by PID.
  - Suite **7,872 locally** (`7872 / 7870 / 0 / 2`, `duration_ms 116,207`),
    +9 against 7,863, exactly this file's new cases.
  - **AND CI MATCHES on `9d2f8319`** (the product tree is `d6f5e55e`'s):
    - Unit run **36186783484** reads `7872 / 7868 / 0 / 4` (`duration_ms
      99,380`). The total matches, and `pass` differs by exactly CI's four
      skips.
    - All 9 new cases pass by name (`ok 2124`–`2132`). There are 7,872
      distinct result numbers and zero anchored `not ok N -`.
    - **`site build` run 36186783336** (20:36:34 → 20:53:40Z, **17m06s**, all
      twenty steps) read all twelve counts green: TAP 397/397/0/0,
      kit-typecheck 4, site-build **382**, contrast-cases 16, theme-seam 11,
      theme-render 29, site-routing 14 and site-runtime 47. Kit-render /
      kit-a11y / kit-effects / kit-paint read `all passed`, and the census is
      7 + 4 + 1 = **12**.
    - The only `##[error]` lines are the two known annotations
      (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`).
    - `site-build.mjs` took **12m21s**.
    - **The stamp chain ends at `9d2f8319`.**
  - **CI for the previous round is read**:
    - `ce913d06` passed unit 36180050406 (`7863 / 7859 / 0 / 4`) and site
      build 36180050487.
    - `8c0d67a1` passed unit 36180679232 (`7863 / 7859 / 0 / 4`) and site
      build 36180679182, whose twelve counts all match the record (TAP
      397/397/0/0, site-build 382 …; census 7 + 4 + 1).
- **LIMITS**:
  - A page named with none of "page", quotes or an address (*"on the menu"*)
    is not recognised. It reads like *"at the top"*, and telling them apart
    needs the site's page list, which the guard is not given.
  - A quoted bare name (‘Menu’) refuses even on its own page.
  - A page refusal uses the ordinary text-guard sentence (*"identify the
    section by its unique heading…"*), which does not say the page was the
    problem. Recorded, not changed.
- **AN IMAGE INPUT**: the predicted id at `d6f5e55e` is **`3d1d8d585b309152`**
  (187 inputs). The same predictor re-derived main (`a51d8b32e5869576`) and
  `db5babc8` (`18725c075657d7e3`) as recorded.

### THE CONSOLIDATED EDIT-PATH MILESTONE (2026-09-25, late, `01222bab` onward, merged and deployed in deploy 2160)

Owner: *"complete one consolidated edit-path milestone … return one reviewable
batch. Don't stop after each small finding to ask whether to continue."* Six
areas: the checklist, target selection, failure and billing paths, database
context on full rewrites, free coverage, and the final live acceptance. **The
checklist, every item marked demonstrated / reproduced defect / unverified /
deferred with its evidence, is the top section of
`docs/investigations/edit-path-checklist.md`.** **Every model answer in the
evidence is SUPPLIED**: the tests establish what the route and the browser do
with an answer, never what a real model answers.

**NINE COMMITS, each reproduced first through the real route or the real
handlers:**

- **`01222bab` — PAGE NAMES COME FROM THE SITE'S OWN PAGES.** *"Remove the
  ‘Chords’ section on the menu"* published on `/` of a site with `/menu`: the
  guard knew no bare page names, so the target ended at "on".
  `sitePageNames(pages)` (`builder/page-prose.mjs`) reads each page's last
  address segment (`/` is "home") and every label the site's own menu links to
  it with; the route passes `pages: eSrc`.
  - **A name two pages share names neither**, and grants nothing.
  - The longest name wins ("Menu Board" before "menu"), and a name never
    crosses punctuation.
  - A form's own in/of still names a section ("the text in Hours").
  - `/#hours`, an outside link and a `-parts/` file name no page; a quoted
    site page name is that page.
  - **An apostrophe between two letters is part of the word** ("Fred's"),
    never a quote mark.
  - **Words that name no page on the site are not a page**, so "at the top"
    keeps its meaning. The cost: a site page name used as an ordinary word
    after on/in/from reads as that page and fails closed.
  - 13 cases, red 6 of 201 on the parent; probes `page-names.json` 18/18 with
    2 controls, `page-qualifier.json` re-anchored and 30/30 with 3.
- **`9e70f093` — A ROUTING STOP KEEPS THE MESSAGE** (next-task 9). `lost()`
  holds the words and files on the ORIGIN site through `siteHoldUnsent`,
  before `finish` redraws, so that site's composer gets them back and no
  other; a newer draft is left alone; nothing resends it (the routing call is
  billed). An existing site's round, cleared before routing, gives back the
  ORIGINAL request and its picture. 9 cases, all red on the parent; the 33
  stop cases in `site-route-failure` assert the hold too.
- **`324bc47a` — A STOPPED EDIT'S UNPUBLISHED DESIGN IS PUT BACK.** A rung
  writes its look or stylesheet into the stored config BEFORE the one publish,
  and only a compile failure restored the snapshot. So a job cancelled at the
  publish gate, a correction that still missed or ran out of time, or a verify
  that threw left the change stored and unpublished — **and the next,
  unrelated edit compiled from the store and shipped it** (reproduced:
  `#014421` went out with a name change).
  - `restoreEditConfig` runs on all of those exits.
  - `eConfigWritten` is set at each rung's own successful write, so a message
    that wrote nothing writes nothing back.
  - A restore that fails is SAID: the change could go out with the next edit.
  - The verify catch does not wind back a design the second publish already
    shipped.
  - Red 3 of 4 on the parent.
- **`51e39e3c` — THE LOGO RUNG READS `{name, data}`**, the composer's own
  attachment shape. It read bare strings, so *"Use this picture as the logo"*
  with the picture attached answered *"Attach the logo with the 📎 button"*.
  **Every test of the rung posted a bare string, and the 2026-09-24 live check
  stopped the edit POST in the page** — the browser half was proved and the
  reader of it never ran, which is why neither could see it. Red 4 of 5 on the
  parent.
- **`908c12ee` — MONEY IS STATED FROM THE LEDGER, BY THE READER THAT HOLDS
  IT.** Server failure sentences claim no money. `wholeRequestNote` states the
  edit's cost from the reply (a real number only) and the routing call's from
  the routing reply.
  - **A job's reply is stored BEFORE the consumer's refund**, so the poll
    route overlays a finished non-done job's cost from its own row
    (`ledgerEditCost`: `refunded`/`none`/`exempt` → 0, `finalized` → its
    cost, anything else → no cost at all) through `servedEditReply`.
  - The synchronous reply reports what its ledger still holds after
    `refundCredits` (`syncKept`).
  - **A refused step's own charge rides on its `partial[]` entry** and is said
    beside the change that shipped (*"That part still cost N credits."*).
  - A refused move carries `unchanged: true`, as a refused removal did, and
    `editGateRefusal` claims no money.
  - `edit-failure-paths` 6 → 16 cases, red 8 of 15 on the parent; 39 cases in
    15 files re-anchored from the old wording to the property; probes
    `edit-money.json` 17/17, 2 controls.
- **`a3efddef` — AN UNKNOWN OUTCOME NEVER POINTS AT THE PREVIEW.**
  `unreadEditMsg` is *"I couldn’t read the answer to that change, so I can’t
  tell whether it went through. Asking for it again could make the change
  twice."* — the add-on's not-knowing sentence one noun over, true whatever
  the layer (the preview shows no row and no rule). Red on the parent over
  four layers and three unknown shapes.
- **`90efa38d` — WHAT WENT THROUGH BEFORE A FAILED PUBLISH IS NAMED.** A new
  address, a saved row and a table rule are live when their rung writes them;
  only the one publish can fail, and the reply said *"your site is
  untouched"*.
  - `landedNote(body)` names each (`renamed`/`forgot`; `layer === "rules"` or
    `"data"` with `applied[].table`), and `landedSaid` appends *"Part of it did
    go through, though: …"*.
  - `compileMsg(pub, theirs, landed)` and `roomSentence(kind, landed)` take a
    STRICT `landed === true` flag — `.map(roomSentence)` hands an index in,
    which a truthy test would read as landed — so no arm says "nothing was
    changed" over a change that landed. `editStopped` names them too.
  - **Nothing is rolled back.**
  - 7 cases, 6 red on the parent and the control green on both; probes
    `landed-changes.json` 11/11, 1 control.
- **`80ce60f4` + `8f66dfb9` — A FULL REVISE KNOWS THE DATABASE THE SITE
  HAS, READ-ONLY.** This closes the backlog's *"THE FULL REVISE DOES NOT"*, and
  **NOT by "the obvious fix"** recorded on 2026-09-22: `needsDb`, and so
  `ensureSiteBackend`'s heal and provisioning, is decided exactly as before.
  - When the ownership row carries no connection, the revise asks
    `siteBackendDetail` (resolves and proves, writes nothing) into a SEPARATE
    `revConn`. `unreadable` stops it: 503 `backend-unreadable`, the deposit
    reversed.
  - The writer's spec is read with `specForAddon` (catalog first) from
    `db || revConn` and merged by `withStoredSpec`: tables, functions AND apis
    by name, the request's own entry winning. A `ready` site's revise had lost
    its functions from the digest.
  - **A revise whose stored spec cannot be read stops**, refunded. **A first
    build does not**: its read can only repeat the schema it has just applied,
    so it builds on `spec` as before.
  - **That scoping was found while recording**: the first cut stopped a first
    build with a supplied schema right after provisioning, reproduced through
    `react-build` with the catalog refused.
  - 6 cases: red 4 of 5 on the parent, and the first-build case red on
    `80ce60f4`. Probes `revise-backend.json` 9/9, 1 control.
  - **The new cost, stated**: a `ready` site whose tables cannot be recovered
    now has its revise REFUSED, where before it was revised from the partial
    spec.

**REVIEWED, NO NEW DEFECT**: paid reconstruction from an edit or add-on
escalation. The `EDIT_FAILURES` census and both readers' validation hold.
**The add-on route asks for a rebuild in ONE place** (`reconstruct: true`;
`addonFailure` ignores the flag for any reason but `no-source`/`no-meta`), and
only after the page read, the database state, the strict config and schema
reads, the build configuration and a strict read of the remaining component
files have all worked AND the saved pages read back empty or the saved look is
absent with no stylesheet. Every earlier failure stops with a sentence; the
list is in the checklist (2026-09-26).
**COVERAGE**: every area the owner listed already has driven cases
(`edit-lock`, `edit-result-display`, `edit-page-photos`/`-protect`,
`edit-page-context`/`-contract`, `edit-failure`, `edit-rules-backend`,
`edit-page-once`, `edit-reply-validation`); no concrete gap was found, so no
coverage-only test was added.

**NUMBERS.**
- 55 new cases (13 + 9 + 4 + 5 + 10 + 1 + 7 + 6). The 25 test files the
  milestone touched (`git diff --name-only c4707515..8f66dfb9 -- test/`) read
  **995 / 995** together.
- Suite locally **`7927 / 7925 / 0 / 2`** at `8f66dfb9` (`duration_ms
  115,553`), +1 against `80ce60f4`'s 7,926: the first-build case.
- Unit CI on `8f66dfb9` reads **`7927 / 7923 / 0 / 4`** (run `36202704161`,
  `duration_ms 125,236`), on `80ce60f4` **`7926 / 7922 / 0 / 4`** (run
  `36201665438`) and on `90efa38d` **`7921 / 7917 / 0 / 4`** (run
  `36200973819`). Every total matches its local run, `pass` differing by CI's
  four skips.
- **57 new-or-renamed test names were found passing BY NAME** in `8f66dfb9`'s
  downloaded log against `c4707515`'s (run `36188563432`), with 7,927 distinct
  result numbers and zero `not ok N -`. Two are renames of cases whose names
  said "nothing was charged".
  - ⚠ **The BOM trap, met a third time and one layer further out.** Result
    5200's line opens with a byte-order mark BEFORE its timestamp, so a name
    parser that strips the timestamp first misses it and reports that case
    "gone" while its number is present. Strip the BOM first, then the
    timestamp, then a BOM again.
- **`site build` passed on each product push**, all twenty steps, with all
  twelve counts matching the record: TAP 397/397/0/0, kit-typecheck 4,
  site-build **382**, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47, kit-render / kit-a11y / kit-effects /
  kit-paint `all passed`; census 7 + 4 + 1 = **12**. The only `##[error]`
  lines are the two known annotations.
  - run `36200973701` on `90efa38d`: 25m21s, `site-build.mjs` 18m45s;
  - run `36201665364` on `80ce60f4`: 23m10s, 16m55s;
  - run `36202704088` on `8f66dfb9`: 24m09s, 17m41s.
- **The stamp chain ends at `8f66dfb9`.**

**STILL OPEN, SAID.**
- #418.
- The build path's money sentences (`BUSY_BUILD_MSG`, `GATED_BUILD_MSG`,
  `STALE_BUILD_MSG`, the build timeout, `NO_CONTAINER_MSG`, *"you weren't
  charged"*), and *"Your database is live"* said on a site that has none.
- The add-on reader states no routing charge, and `lostPhotosMsg` still says
  *"nothing was charged"*.
- **Two refund policies**: the synchronous path keeps a failed publish's
  collects while the job path refunds everything, landed work included. Both
  are now reported from the ledger.
- Text-guard grammar limits.
- ~~`eConfigWritten` and the verify catch's restore are read in code, not
  driven~~ — **CLOSED 2026-09-26** (`edit-failure-paths`, 22 → 29 cases). The
  correction's flag is load-bearing when the css lane answered the sheet
  unchanged beside a step that publishes: driven on both money paths (a job
  whose correction still misses; a synchronous edit whose corrected build the
  store refuses), with a same-shape control on both; removing the flag fails
  both stop cases and passes both controls. The verify catch is UNREACHABLE by
  any failure the round meets — each operation handles its own; driven at
  every boundary (model call, write, store, gate), and a marker in the catch
  was reached 0 times across the whole suite (7,934 tests). Probes
  `rollback-gaps.json`: 3 killed, 1 control.
  **⚠ AND THE FLAG'S LOAD-BEARING SHAPE WAS THE STYLESHEET-SCOPE DEFECT BELOW**
  (fixed, merged and deployed in deploy 2161): a correction on an unchanged sheet can no
  longer be built, so a correction always follows the look step's own flagged
  write and the flag is a second wall. Measured by hand: removed alone, every
  case passes; removed beside the look step's flag, 14 fail. The four cases
  that drove the old shape went with it, and R-1 left the spec.
- ~~**Reproduced, not fixed**: `compileMsg` drops the restore warning~~ —
  **FIXED, MERGED AND DEPLOYED IN DEPLOY 2161** (*a publish is held only for the rules a
  request wrote, and a failed restore is always said*, below): every arm takes
  the restore's result.
- ~~**Found, not fixed**: the render check judges EVERY rule in the stored
  sheet~~ — **FIXED, MERGED AND DEPLOYED IN DEPLOY 2161** (the same section): a publish
  is held only for the rules the request wrote.
- Drafts are session-only; the needs-review enqueue sentence is never shown.
- Real-model compliance is unproven throughout.

**THE IMAGE.** `worker.js`, `site-owner.mjs`, `builder/page-prose.mjs`,
`builder/site-logo.mjs`, `builder/container-room.mjs`,
`builder/build-lease.mjs`, `builder/edit-job.mjs` and
`builder/site-reconcile.mjs` are inputs, so a merge rebuilds: predicted
**`c3cc126e45e93815`** at `8f66dfb9` (187 inputs, 157 distinct paths), from
main's `a51d8b32e5869576`.

### MERGED AND DEPLOYED: THE CONSOLIDATED MILESTONE AND THE ROLLBACK ROUND (2026-09-26)

Owner: *"The consolidated batch has been reviewed at 4f6ab55c. The independent
484 focused checks passed, and unit/site-build CI is green. … After the focused
checks and required CI pass, merge and deploy this reviewed batch. Preserve
main's existing changes. Read the actual deployment SHA and image from the
deployment, then verify them through the existing authenticated GitHub
workflow. No F12 and no paid dispatch."*

- **THE ROUND BEFORE THE MERGE** (`7384ddba`, tests and documents only):
  - the two rollback edges were closed (the milestone's STILL OPEN list,
    above);
  - the checklist names the add-on route's rebuild conditions;
  - two findings are recorded, not fixed.

  Suite locally `7934 / 7932 / 0 / 2` (+7, exactly the new cases), and the 25
  files the milestone touched read 1,002 / 1,002. Unit CI run
  **`36206886612` on `7384ddba`** read `7934 / 7930 / 0 / 4`, with all seven
  new cases and the kept control found passing BY NAME, 7,934 distinct result
  numbers and zero `not ok`. No site build is owed: the round touched none of
  its paths, and the product tree is `8f66dfb9`'s, whose run `36202704088` is
  green.
- **A FAST-FORWARD, SO NOTHING ON MAIN COULD BE LOST**: `main` `c2fa000c` →
  **`7384ddba`** at 01:02:47Z, 21 commits, 50 files (+5,500 / −235). Asked before the push:
  - `main` had not moved;
  - zero runs were in progress, queued or waiting;
  - the image id was predicted over both ends (the deploy section);
  - the rollback was verified — reverting `c2fa000c..7384ddba` in a throwaway
    worktree gives tree `4fcc262c…`, main's own, so a rollback reuses
    `a51d8b32e5869576`.
- **DEPLOY 2160 (`36207057160`)**, success, job 01:02:52 → 01:05:53Z.
  - `DEPLOY_ID` `7384ddbac4ba05b725***c52aa53d6fc9e0***8a9699` (each `***` a
    masked `1`), and the gate took over from `c2fa000c…`.
  - The image was **built `c3cc126e45e93815` and rolled from
    `a51d8b32e5869576`**. The drain found `no live leases`.
  - `+ /edit-poll.js`, `+ /chat.js`: 2 uploaded, 84 already. `Uploaded
    isibi-app`, `Current Version ID: 70c103d6-…`, `Deployed isibi-app
    triggers`.
- **THE SERVED FILES, BOTH READINGS.**
  - Before (01:01:05Z): `chat.js` 782,960 bytes `d5b10edb5534dae5` and
    `edit-poll.js` 29,391 bytes `7d7da74ed3b3c160`, each byte-identical to
    `c2fa000c`'s.
  - After (a poll saw the change at 01:05:48Z, the second Wrangler finished;
    read at 01:06:22Z): **786,047 bytes `e56f1c9f4ffca3da` and 29,659 bytes
    `ebc0e7094320a447`, each byte-identical to `git show 7384ddba:public/…`**,
    with and without a query string.
  - Discriminators 0 → N: `refusedCost` 0 → 3 and *"could make the change
    twice"* 0 → 1 in `chat.js`; `wholeRequestNote` 0 → 1 in `edit-poll.js`.
  - Gates 401 / 401 / 401 / 404.
- **DEPLOYED, NOT YET RUNTIME-CONFIRMED.** The image rolled, so the press
  was held until 01:22Z. The session's own dispatch, re-tested then (spend
  `no`, both expectations), answered **403** again, so the confirmation is the
  owner's free press: `edit-canary.yml` from `main`, spend `no`,
  `expect_deploy` `7384ddbac4ba05b7251c52aa53d6fc9e018a9699`, `expect_image`
  `c3cc126e45e93815`. It also takes the fresh before-read Test 3 starts from.
  **Never pressed**: deploy 2161 replaced this build first. Run 33 then
  confirmed 2161, whose tree carries all of 2160's code (*merged and deployed:
  the stylesheet scope…*, below).

### A PUBLISH IS HELD ONLY FOR THE RULES A REQUEST WROTE, AND A FAILED RESTORE IS ALWAYS SAID (2026-09-26, merged and deployed in deploy 2161)

Owner, after the merged batch: *"Close the two concrete findings together before
the paid Test 3 … Return the fixes for review before another merge or
deployment."* These are the two findings the rollback round recorded as not
fixed (above). **Every model answer in the evidence is supplied.** The
consolidated checklist's top section is the per-item record.

**1. THE STYLESHEET CHECK IS SCOPED TO THE REQUEST.**
- The route records two sheets on `cssCtx`: the one the css lane was SHOWN
  (`before`) and the one it STORED (`after`). **`cssCtx` is made only once a
  changed sheet is stored**; it had been made when the lane was PICKED, before
  it answered.
- `changedSelectors(before, after)` names the selectors of every rule that
  differs. A rule is its surrounding at-rules, its selector list and its
  declarations, with the whitespace CSS ignores taken out. A recoloured old
  rule IS judged, because the request wrote it.
- That list goes to the spine as `verifyCss` and on to the build service as
  `cssVerify`. The service judges `selectorsToJudge(sheet, cssVerify)`:
  - with the list absent (every build, and every publish that asks nothing),
    every rule;
  - with the list present, only the named rules the sheet has.
- The spine filters the report by the list too. That is the belt for a
  container still on the previous image, which judges every rule.
- **SCOPING THE MEASUREMENT, NOT ONLY THE DECISION, IS LOAD-BEARING.**
  `renderReport` caps the dead list at `MAX_FINDINGS` (24), and the judge caps
  its selectors at `MAX_SELECTORS` (300). Both count from the top of the sheet,
  and a lane appends its new rule last.
- **ONE WALKER (`styleRules`) SERVES `plainSelectors` AND `changedSelectors`**,
  because the gate matches the two lists by EQUALITY. Old and new
  `plainSelectors` were compared over 27,622 stylesheet-like inputs (4,848
  non-empty): 0 differences.
- The job's second publish verifies the rules that differ between `before` and
  the corrected sheet: `cssCtx.after` moves when the correction's write lands.

**2. A FAILED RESTORE IS SAID BY EVERY FORMATTER.**
- `compileMsg(pub, theirs, landed, kept)` carries a strict `kept === true` to
  every arm. "Nothing was changed" becomes "your live site wasn't changed", and
  every answer ends with `KEPT_CHANGE_NOTE`: *"The change itself is still
  saved, though, so it could go out with your next edit."* `roomSentence` takes
  the same third state.
- The sentence is ONE constant. It is shared by `compileMsg`, `editStopped`,
  the correction round's catch and the add-on route's failure reply. **The
  add-on route had the same defect**: it logged a failed revert and called the
  site untouched.
- **The constant is declared at module level near `compileMsg`, so the add-on
  route composes its kept schema sentence INLINE.** A module-level `const`
  built from it above its declaration would be a load-time TDZ throw.
- Nothing claims a rollback or a refund. The direct path keeps its collects,
  and a job's refund is the consumer's, read off its row.

**THE EVIDENCE.**
- **Tests.** `test/edit-failure-paths.test.mjs` goes from 29 to 39 cases.
  - 4 were removed: the previous round's "the correction was the only config
    write" cases and their controls. Their premise, a correction on an
    unchanged sheet, is the defect itself, so the shape cannot be built.
  - 14 were added.
  - `test/css-scope.test.mjs` is new, with 5 cases. The add-on route gains 1.
  - Each route case asserts the stored config, the exact screen, the ledger
    and the next edit.
  - The render check is MODELLED as the build service's own selection
    (`judge`, over the real `selectorsToJudge`), and the compiler fixture now
    hands a render function the payload.
- **Red on the unfixed `222d1182`: 14 failures** — the 12 new behaviour cases
  and 2 re-anchored guards.
  - Of the new cases, 10 are in `edit-failure-paths`, one is the add-on route
    and one is the build service's wiring census.
  - The new cases that pass there should pass there: the two restore-lands
    controls, the cancel case (its sentence was already right), the
    reachability case, and css-scope's reader cases.
  - With the request-level assertions cut, the menu-edit case still fails on
    the store alone ("the stylesheet was rewritten").
- **Re-anchored, not appeased — four guards pinned to a spelling this change
  moved** (the first two are the red run's two guard failures; the other two
  pass on the old code too):
  - `edit-queue`: the window closes on `const cssVerify2 =`.
  - `site-migrations`: the add-on sentence's shape, with the revert's result
    known before it.
  - `edit-reserve-refused`: the `ours` test itself, not its `return`.
  - **`publish-clock`**: its fallback landmark was `return pub.error ===
    "read"`, which became `return said(…)`. Re-anchored on the clause and
    asserted unique. An order mutant turns it red.
- **⚠ THE LAST ONE WAS OUTSIDE THE 47-FILE FOCUSED SET**, and only the full
  suite found it: it failed 1 of 7,950 on the first full run. That is the
  recorded trap met again — a focused list is believed for a green, never for
  completeness.
- **Hand-measured before the probes**:
  - The correction's `eConfigWritten = true` alone SURVIVES, because a
    correction always follows the look step's own flagged write. The pair with
    the look step's flag is KILLED (14 failing).
  - The `cssMoved` condition alone SURVIVES, because an unmoved sheet names no
    rule. The pair with a whole-sheet list (the defect back) is KILLED (6
    failing).
  - Both are kept, with the reason in the code. `rollback-gaps.json` drops R-1
    and re-anchors R-3.
- **Probes, not a sweep**, over the 47 focused files:
  - `scripts/mutants/css-scope.json`: 19 mutants, 19 killed, 0 survived, 0
    never applied, the comment-only control surviving;
  - `rollback-gaps.json`: 2 killed, the control surviving.
  - `worker.js` was byte-identical to its pre-run copy afterwards, and every
    builder anchor was present once with no mutated text.
- **⚠ AN ANCHOR CENSUS'S "replacement text found" IS NOT A LIVE MUTANT BY
  ITSELF.** K-5's replacement, `(kept ? KEPT_CHANGE_NOTE : "")`, is also the
  verify catch's own spelling, where `kept` is a real boolean. The byte
  comparison with the pre-run copy is what settles it.
- The 47 focused files read 1,682 / 1,682.
- **Suite 7,950 locally** (`# tests 7950 / # pass 7948 / # fail 0 / # skipped
  2`, `duration_ms 115,913`). That is **+16 against 7,934**, exactly this
  round's net cases: `edit-failure-paths` +10, `css-scope` +5, the add-on route
  +1. The first full run read `7950 / 7947 / 1 / 2`, and the one failure was
  the `publish-clock` guard above.
- **AND THE CI UNIT HALF MATCHES**: run **`36213341827` on `c084e5c5`** reads
  **`# tests 7950 / # pass 7946 / # fail 0 / # skipped 4`** (`duration_ms
  125,004`). The total is what matches; `pass` differs by CI's four skips.
  All 24 new or re-anchored cases were found passing BY NAME in the downloaded
  log archive, with 7,950 distinct result numbers, no gap and zero
  `not ok N -`.
- **AND `site build` run `36213341839` on `c084e5c5`** (02:58:19 → 03:22:58Z,
  **24m39s**, all twenty steps) read all twelve counts green out of its
  per-step files:
  - TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
    theme-seam 11, theme-render 29, site-routing 14, site-runtime 47;
  - kit-render / kit-a11y / kit-effects / kit-paint `all passed`;
  - census 7 + 4 + 1 = **12**.
  - The only `##[error]` lines are the two known annotations
    (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`); `tsc`-format lines
    read 9 / 2 / 7.
  - `site-build.mjs` took **18m07s**. This is the harness that runs the build
    service's changed line against real compiled sites, with no `cssVerify`
    sent — every rule judged, as before.
  - **The stamp chain ends at `c084e5c5`.**

**⚠ ONE ARM IS CHECKED BY SHAPE ONLY, AND SAID**: the add-on route's
schema-refusal sentence with a refused revert. Its compile arm is DRIVEN (the
new add-on case). But no harness in the tree makes the add-on's database apply
refuse, and that arm's plain sentence has only ever been asserted by shape
(`site-migrations`) — so the kept variant is asserted the same way, as
`aKept ? "…" + KEPT_CHANGE_NOTE : ADDON_SCHEMA_FAIL_MSG`.

**FOUND ON THE WAY, NOT CHANGED**:
- Beside an unchanged look, the menu change is not named in the reply (review
  #9, asserted as it stands).
- The look step's own rollback block after `publishStep` is unreachable, since
  `publishStep` defers and always answers ok.

**TEST 3 DOES NOT DEPEND ON EITHER FIX**, as an expectation rather than a
promise: one fix needs the css lane picked, the other a failure of ours whose
restore also fails. **If these merge first, Test 3's `expect_deploy` and
`expect_image` change** to the merge's sha and the image its deploy builds.
`worker.js` and three builder files are image inputs. **Predicted over
`c084e5c5`: `168a9f94d1e6783e`** (187 inputs, 157 distinct paths). The same
reader reproduces main's `c3cc126e45e93815` first. Documents-only commits on
top do not move it, but **re-run the predictor over the merge commit itself**
before pressing. **It moved again with the rule-key correction below**
(`1ee5606e09db1a67` over `991b9204`), **and again with the comment-boundary
correction** (`ca1fd6e66bc5bab9` over `3cee046f`, then `05750a5120d33570` over
`9aef0ca2`).

### A QUOTED VALUE, AN ESCAPE OR A SELECTOR'S OWN WHITESPACE IS PART OF THE RULE (2026-09-26, merged and deployed in deploy 2161)

Owner, after reviewing the round above: *"One new defect remains in ruleKey's
whitespace normalization … Preserve meaningful whitespace and escapes inside
quoted selectors, declarations and at-rule conditions. Normalize only where
equivalence is established; uncertain differences should remain changed. Keep
this bounded—no CSS subsystem redesign."* The CSS-scoping and failed-restore
cases passed that review and are unchanged. **Every model answer in the
evidence is supplied.**

- **REPRODUCED FIRST, THE OWNER'S WAY**, through the real edit route on both
  money paths. The page carries `data-label="a  b"` (two spaces), the stored
  rule selects it, and the css lane — picked beside a menu change — answered
  the sheet back with the value respaced to ONE space. The compiler was sent
  `cssVerify: []`, nothing was judged, one build shipped `[data-label="a b"]`,
  the job committed, and the screen said *"✅ Updated the look — the design. …"*.
- **AND THIRTEEN MORE PAIRS ANSWERED `[]` ON THE OLD MODULE, each measured**: a
  tab inside the quotes; a quoted declaration (`content:"a  b"`, a colon's
  spacing inside one, comment-shaped text inside one, a quoted custom
  property); a quoted `@supports selector(…)`, `@container style(…)` and
  `@scope` root; an escaped space (`.a\  b`); a hex escape and the whitespace it
  owns (`.\31  0` is a class and a descendant, `.\31 0` the class "10"); and
  whitespace before a colon inside `selector()`, in `@scope`'s root and in a
  nested rule (`a :hover` is not `a:hover`).
- **THE CAUSE WAS TWO LAYERS.** The key collapsed `\s+` and stripped whitespace
  around punctuation everywhere, strings included; and it read the walker's
  BLANKED copy, where `blankComments` — not string-aware — turns comment-shaped
  text inside a string into spaces.
- **THE FIX IS BOUNDED TO THE KEY.** The walker also cuts each rule's own text
  (`ctx`, `prelude`, `body`) at its offsets, which blanking does not move. The
  key reads that text with a small reader (`cssPieces`):
  - strings, escapes (a hex escape with the one whitespace it consumes) and an
    unquoted `url(…)` are kept as written;
  - a comment is whitespace — the walker's reading, and so the judge's
    (**⚠ WRONG, and the owner's next review said so: a comment is a token
    boundary, not whitespace** — the next section);
  - a whitespace run is one space, and whitespace is dropped only where CSS
    defines it as nothing: at either end; next to a comma; next to a block's
    top-level `{`, `}` or `;`; next to a declaration's own colon and its `!`;
    next to a feature's colon in a condition (`(max-width: 600px)`);
  - empty declarations are dropped (`{;a:1;;b:2;}` is `{a:1;b:2}`);
  - every colon in a SELECTOR keeps its whitespace: the rule's own, a nested
    rule's, `@scope`'s root and `selector()`'s argument.

  The key is `JSON.stringify` of the three spellings, so no separator can
  collide. **The walker's structure, `plainSelectors` and what the build
  service judges are unchanged.**
- **THE DIRECTION.** What the old key equated and CSS does not now reads
  changed and is judged: quote style; an empty item in a selector list (which
  invalidates the whole list); a no-break space (a name character, which the
  old `\s` collapsed); whitespace inside an unquoted `url()`; a second colon in
  a value; a feature colon at a condition's top level. **One equivalence is
  new**: empty declarations, which the old key read as changed.
- **EVIDENCE.**
  - `test/css-scope.test.mjs` goes from 5 to 9 cases: the reproduced shapes; the
    formatting control with quoted values, escapes and conditions present; the
    equivalences CSS does not establish; and a property over 1,500 random sheets
    carrying quoted values, escapes and conditions. In the property, whitespace
    and comments added only where CSS ignores them name nothing in either
    direction and leave `plainSelectors` as it was. **Measured**: 3,470
    selectors judged, and 1,428 of the 1,500 sheets carrying a quoted value.
    **⚠ AND IT BARELY FORMATTED ANYTHING**: its random generator was
    degenerate, and it inserted formatting 183 times across the 1,500 sheets
    (the next section, which made it exact and re-measured it).
  - **The battery's stamp moved by ONE pair** (511 → 512 named, 2,489 → 2,488
    quiet), measured pair by pair against the old module: its respacing
    mutation rewrites the brace inside `content:"{"`, a string whose value that
    changes.
  - `test/edit-failure-paths.test.mjs` goes from 39 to 47 cases, judged by
    `pageJudge`, which reads an attribute selector against the value the page's
    own source carries, character for character:
    - the respaced value is sent to be judged, found dead and corrected, on
      both money paths, with the correction asked about that rule alone (the
      job's second publish verifies `[]`, the corrected sheet being the site's);
    - the job is refused when the correction still misses: nothing published,
      the sheet put back, refunded, and the next edit ships the rule the page
      matches;
    - a quoted declaration and a quoted `@scope` root are sent to be judged,
      and nothing else (both paths);
    - the same sheet reformatted is sent for nothing (both paths).
  - **Red on the unfixed `933168ea`: 8 of 56** across the two files — the three
    new unit tests and the five route cases carrying the defect. The route
    formatting controls, the property, the judge's self-check and every earlier
    case pass there. **The unit formatting control fails there only on its two
    empty-declaration lines** (measured by cutting them): the old key read
    those as changed, the safe direction.
  - The 49 focused files (last round's 47, plus `site-fonts` and
    `site-theme-registry`, which import this module) read 1,728 / 1,728.
  - **Suite 7,962 locally** (`# tests 7962 / # pass 7960 / # fail 0 / # skipped
    2`, `duration_ms 115,870`): +12 against 7,950, which is `css-scope` +4 and
    `edit-failure-paths` +8.
  - **AND THE CI UNIT HALF MATCHES**: run **`36216866723` on `991b9204`** reads
    **`# tests 7962 / # pass 7958 / # fail 0 / # skipped 4`** (`duration_ms
    124,908`). The total is what matches; `pass` differs by CI's four skips. All
    twelve new cases, and the battery whose stamp moved, were found passing BY
    NAME in the downloaded log archive, with 7,962 distinct result numbers, no
    gap and zero `not ok N -`.
  - **AND `site build` run `36216866790` on `991b9204`** (04:07:04 → 04:29:46Z,
    **22m42s**, all twenty steps) read all twelve counts green out of its
    per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**,
    contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
    site-runtime 47, and kit-render / kit-a11y / kit-effects / kit-paint `all
    passed`; census 7 + 4 + 1 = **12**. The only `##[error]` lines are the two
    known annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`);
    `tsc`-format lines read 9 / 2 / 7; `site-build.mjs` took **16m33s**. That
    harness runs the build service's `selectorsToJudge` — through the walker
    this change touched — against real compiled sites. **The stamp chain ends
    at `991b9204`.**
  - **No mutation sweep**, per the instruction (*"focused tests and required CI
    only"*); the red run is the evidence the new cases bite.
- **FOUND ON THE WAY, NOT CHANGED:**
  - **The walker does not honour a backslash-escaped quote, and a rule after one
    is invisible to BOTH readers.** `.q{content:"\""} header button{color:red}`
    → `plainSelectors` answers `[".q"]`; without the escape it answers both.
    So a broken rule written after such a declaration is never judged, by the
    old whole-sheet check or this one, and the build service's own selection is
    blind the same way. Pre-existing. Fixing it changes what every build
    judges, which is beyond the key.
  - **After a correction that restores the sheet the site had, the screen still
    says "✅ Updated the look — the design. …"** and names no menu change: the
    reply is composed from the lane's first answer (review #9's class). Pinned
    in the route case as it stands.
  - **The check reads a rule's own selector**, never an `@scope` root or a
    condition. A rule inside a condition whose quoted value changed is sent to
    be judged, and it is judged by its selector alone.
- **THE IMAGE MOVES AGAIN**: `builder/site-freecss.mjs` is an image input.
  **Predicted over `991b9204`: `1ee5606e09db1a67`** (187 inputs, 157 distinct
  paths). The same reader reproduces main's `c3cc126e45e93815` and
  `c084e5c5`'s `168a9f94d1e6783e`. If this merges before Test 3, its two
  expectation boxes change: read both off the deploy and the free press.

### A COMMENT IS A TOKEN BOUNDARY, NOT WHITESPACE (2026-09-26, merged and deployed in deploy 2161)

Owner, after the quoted-value correction passed review: *"One remaining
equivalence error is reproduced on e49a370c … Preserve selector meaning across
both readers. Do not simply delete every comment and concatenate tokens; that
can change token boundaries. Keep uncertain differences classified as
changed. … Add this route regression and a browser-backed control
establishing which selector matches the fixture."* **Every model answer in the
evidence is supplied.**

- **REPRODUCED FIRST, THROUGH THE REAL ROUTE, BOTH MONEY PATHS.** The page
  carries `<p className="a b">` and nothing inside it; the stored rule is
  `.a/**/.b{…}`; the css lane answered `.a .b{…}`. The compiler was sent
  `cssVerify: []`, nothing was judged, one build shipped the descendant, the
  job committed, and the screen said *"✅ Updated the look — the design. …"*.
- **CSS CONSUMES A COMMENT WITHOUT PRODUCING WHITESPACE**, so `.a/**/.b` is the
  compound `.a.b`. **Measured in a real Chromium**: the rule applies to the
  paragraph, and the browser's own CSSOM serialises it as `.a.b`. `.a .b` is a
  descendant that matches nothing there. `querySelectorAll` answers 1 for
  `.a/**/.b` and `.a/* x */.b`, 0 for `.a    .b` and `.a .b`, and throws for
  `a/**/b` — the render check counts a throw as a hit.
- **TWO READERS, ONE CAUSE.**
  - **The key** read a comment as whitespace (`GAP`), so the two spellings keyed
    as one rule.
  - **`plainSelectors`** cut its selectors from the walker's comment-BLANKED
    copy, so the judge was handed `.a    .b` — a descendant, the wrong meaning —
    for the compound. It blanked a comment-shaped attribute value
    (`[data-x="/* a */"]`) into seven spaces the same way.
- **AND A COMMENT IS NOT NOTHING EITHER.** `a/**/b` is two tokens and `ab` one;
  `1/**/.5` is two numbers and `1.5` one; `x/**/(` is not a function and `x(`
  is; `--/**/>` is not `-->`. Deleting comments and concatenating would merge
  tokens — the owner's warning.
- **THE RULE, ONE FUNCTION BOTH READERS SHARE** (`spell` and `keepsBoundary` in
  `builder/site-freecss.mjs`):
  - a comment touching whitespace, or at either end, is part of that
    whitespace;
  - a comment beside a delimiter no token merges across is NOTHING: `{ } ; , :
    [ ] )` either side, and `(` and `>` only before it;
  - any other comment is kept as a boundary and spelled `/**/` — so
    `.a/**/.b` against `.a.b`, which the key cannot establish as equal, reads
    as CHANGED and is judged.
  - `cssPieces` answers a `COMMENT` piece where it answered `GAP`;
    `conditionTight` and `blockTight` skip a comment exactly where they skip
    whitespace.
- **WHAT THE JUDGE IS HANDED** (`judgedSelectors`): `selectorSpans` splits the
  blanked prelude — so a comma or quote inside a comment is still never a
  split — and each span is cut from the sheet's OWN text at the same offsets.
  A span no comment touched is kept byte for byte; one a comment touched is
  respelled by the rule above (`asJudged`), strings kept whole. The gate
  matches the two lists by equality, and both come from this one function.
- **WHAT MOVED AND WHAT DID NOT, MEASURED:**
  - **old against new `plainSelectors`: 0 differences over 21,332
    comment-free inputs** (4,440 with selectors) — the tests' literals, the
    theme registry and a fuzzer on an exact generator;
  - on commented inputs every difference is one of four shapes: a boundary
    kept as `/**/`, a quoted value kept whole, a comment absorbed into
    whitespace or dropped beside a delimiter (the selector's whitespace runs
    then collapsed to one), and a selector newly judged
    because its blanked comment had pushed it past the 200-character bound.
    **A selector can only get shorter**, so none is newly skipped;
  - **⚠ AND THE FIRST CUT JUDGED JUNK, FOUND BY MEASURING THOSE COUNTS.** With
    the length bound lifted on both sides, 9 of 203 count changes remained,
    every one junk with no name in it — `~/**/+`, `+/**/>`. The kept boundary
    carries a `*`, and `judgeableSelector` reads a `*` as the universal
    selector. The browser throws on such a string and the render check counts
    a throw as a hit, so no false alarm could follow, but it was counted as
    judged. **Fixed in `9aef0ca2`**: the "selects something" test ignores the
    marker, and now **194 of 194** count changes are the length bound, none
    downward;
  - **the judged strings, audited in a real Chromium (local, not
    committed)**: 6,000 random selectors with comments placed at random,
    4,254 of them respelled. For **every one**, the written selector and the
    judged string get the same CSSOM `selectorText` and the same
    `querySelectorAll` list, or both are refused. **The old reader fails that
    audit on 1,959 of the 6,000.**
- **THE BROWSER-BACKED CONTROL** (`test/integration/site-build.mjs`, run by the
  site-build workflow with Chromium, beside a shared table in
  `test/fixtures/comment-boundary.mjs`):
  - for every spelling: the page's cascade applies it or not (a custom property
    per spelling, read back through `getComputedStyle`); `plainSelectors` hands
    the judge the table's string; and the page's own `querySelectorAll` agrees
    with the cascade;
  - the REAL `checkRender` over the owner's pair reports `.a .b` dead and
    `.a/**/.b` alive, on the same pages;
  - **run locally against real Chromium: 22 of 22**; against the old reader
    **5 fail** (it hands the judge `.a    .b`, and the real render check then
    reports BOTH rules dead — the stored one wrongly);
  - the unit cases take their page judge from that table, so no liveness is
    assumed in JavaScript; a judged string the table does not hold is recorded
    as UNKNOWN and fails the case. **The site-build workflow's `paths` now
    lists the table**, so changing it runs the browser half again.
- **DURING A ROLL.** A job runs both halves in ONE image — inside the
  container the Worker module's build call is a localhost request to the build
  service beside it (`builder/containers-shim.mjs`). So only an edit that runs
  in the Worker, against a container still on the previous image, can leave a
  comment-bearing selector it changed unjudged, until the roll completes.
  Comment-free selectors are spelled identically by both versions.
- **⚠ AND THE PROPERTY TESTS' GENERATOR WAS DEGENERATE — MY OWN EVIDENCE, TWO
  ROUNDS RUNNING.** `seed = (seed * 1103515245 + 12345) & 0x7fffffff` runs past
  2^53, the product loses its low bits, and every seed becomes a multiple of
  512: `rnd(2)` answered 0 in 19,920 of 20,000 calls. So the previous round's
  formatting property **inserted formatting 183 times across its 1,500
  sheets**, and the gate battery respaced a sheet 3 times in 3,000 pairs and
  used 6 of its 12 selectors. Both now use exact 32-bit arithmetic read from
  the high bits (`Math.imul`): **24,558 random insertions**, plus a
  deterministic pass wrapping every delimiter in a bare comment (**49,134**);
  the battery reaches every way a lane answers a sheet **475–513 times** and
  reads **1,185 named of 7,035 judged, 1,975 of 3,000 quiet**. Both still
  hold, and the floors now prove the formatting ran (a floor on the
  insertions; every way reached). **A negative property must prove it did the
  thing it negates** — the observer floors counted what was JUDGED, never what
  was FORMATTED. Only `css-scope.test.mjs` used this generator. My scratch
  comparison script did too, so its numbers were re-measured with the exact
  generator before being quoted here.
- **EVIDENCE.**
  - `test/css-scope.test.mjs` 9 → **12 cases**: the owner's pair and the
    fixture table spelled by the product, with the boundary's own `*`
    selecting nothing (`~/**/+` skipped, `*/**/.a` judged); a comment CSS
    reads as nothing (ten placements); a comment beside what may merge, read
    as changed (seven); both properties on the exact generator.
  - `test/edit-failure-paths.test.mjs` 47 → **55 cases**, judged by the
    browser's table: the rewritten rule is sent, found dead and corrected
    (both paths — `cssVerify` `[".a .b"]`, the correction asked about it
    alone, the css lane billed 2, the correction not); refused when the
    correction still misses (job — refunded, the sheet put back, the next edit
    ships `.a/**/.b`); a new rule written `.a/* the hours */.b` is sent and
    judged as `.a/**/.b`, live, and ships with no correction (both paths);
    formatting and the same boundary spelled `/* x */` send nothing (both
    paths).
  - **Red on `e49a370c`: 9 of 67** across the two files — the three new unit
    tests and six route cases. The two route formatting controls, both
    properties and every retained case pass there. **The unit comment control
    fails there only on `.a>/**/.b` and `.a/**/[x]`**, which the old key read
    as descendant spaces and named (`.a    [x]` — the wrong meaning, the safe
    direction).
  - The 67 focused files (last round's 49, the files that parse
    `site-build.yml`, and every test naming the harness or this module) read
    **2,016 / 2,016**. **Suite 7,973 locally** (`# tests 7973 / # pass 7971 /
    # fail 0 / # skipped 2`, `duration_ms 115,280`): **+11 against 7,962**,
    which is `css-scope` +3 and `edit-failure-paths` +8.
  - **AND THE CI UNIT HALF MATCHES**: run **`36220333869` on `3cee046f`** reads
    **`# tests 7973 / # pass 7969 / # fail 0 / # skipped 4`** (`duration_ms
    99,778`). The total is what matches; `pass` differs by CI's four skips. All
    20 cases of the two changed test files were found passing BY NAME, with
    7,973 distinct result numbers, no gap and zero `not ok N -`.
  - **AND THE REST OF CI, READ AFTER THE REVIEW, EACH FROM ITS OWN RUN.**
    - **Unit** run **`36220840818` on `9aef0ca2`** reads **`7973 / 7969 / 0 /
      4`** (`duration_ms 125,323`), and run **`36220937877` on the documents
      commit `0de188ff`** reads the same four numbers (`duration_ms 125,754`).
      On both, all 20 cases of the two changed test files pass BY NAME, with
      7,973 distinct result numbers, no gap and zero `not ok N -`.
    - **`site build` run `36220840763` on `9aef0ca2`** (05:27:22 → 05:48:22Z,
      **21m00s**, all twenty steps, the checkout at `9aef0ca2…`) read all
      twelve counts green out of its per-step files: TAP 397/397/0/0,
      kit-typecheck 4, site-build **404** (382 + the control's 22),
      contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
      site-runtime 47, and kit-render / kit-a11y / kit-effects / kit-paint
      `all passed`; census 7 + 4 + 1 = **12**. The only `##[error]` lines are
      the two known annotations, and `tsc`-format lines read 9 / 2 / 7.
      `site-build.mjs` took **15m22s**.
    - **THE BROWSER CONTROL, READ FROM THAT RUN'S OWN STEP FILE — 22 `ok`, 0
      `FAIL`**: the browser read every spelling; for each of the six, the
      page's cascade applies the rule exactly where the table says (`.a/**/.b`,
      `.a/* the hours */.b` and `.a.b` applied, the browser reading each as
      `.a.b`; `.a .b`, `.a /* the hours */ .b` and `.a    .b` not, read as
      `.a .b`), `plainSelectors` hands the judge the table's string, and the
      page's own `querySelectorAll` agrees with the cascade; then the real
      `checkRender` is asked `[".a/**/.b", ".a .b"]`, looks at the page, and
      reports exactly `[".a .b"]` dead.
    - **`site build` run `36220333864` on `3cee046f`** (05:17:00 → 05:41:54Z,
      24m54s) is the parent's record and is NOT substituted for the above: the
      same twelve counts, site-build 404, the same 22 control lines `ok`.
  - **No mutation sweep**, per the instruction; the red runs are the evidence
    the cases bite.
- **THE IMAGE MOVES AGAIN**: `builder/site-freecss.mjs` is an image input.
  **Predicted over `9aef0ca2`: `05750a5120d33570`** (187 inputs, 157 distinct
  paths; `ca1fd6e66bc5bab9` over `3cee046f`). The same reader reproduces main's
  `c3cc126e45e93815` and `e49a370c`'s `1ee5606e09db1a67`. **Deploy 2161 built
  exactly that id** (the next section), so Test 3's two expectation boxes moved
  with it.

### MERGED AND DEPLOYED: THE STYLESHEET SCOPE, FAILED-RESTORE AND RULE-KEY CORRECTIONS (2026-09-26)

Owner: *"The comment-boundary correction passes independent review at
0de188ff: 288 focused tests passed … Finish the site-build check on 9aef0ca2.
Read the new browser-control results from that run … Do not substitute the
earlier commit's result. If it passes, merge and deploy the reviewed correction
batch. Recompute the image from the actual merged tree and read the deployment
identifiers from the deployment. Then verify runtime through the existing free
GitHub canary, spend=no. If dispatch still returns 403, stop retrying … Keep
deployment success separate from runtime confirmation."*

The batch is the three sections above: *a publish is held only for the rules a
request wrote, and a failed restore is always said*; *a quoted value, an escape
or a selector's own whitespace is part of the rule*; and *a comment is a token
boundary, not whitespace*. **Every model answer in its evidence is supplied.**

- **THE SITE BUILD ON `9aef0ca2` PASSED, READ FROM THAT RUN** (`36220840763`,
  the previous section): twelve counts green, site-build 404, and the browser
  control's 22 lines `ok`.
- **ASKED BEFORE THE PUSH** (05:49:12Z):
  - `main` was unmoved at `7384ddba`, an ancestor of `0de188ff`;
  - zero runs were in progress, queued, waiting, requested or pending;
  - the image was predicted over both ends: `7384ddba` → `c3cc126e45e93815`
    (what deploy 2160 built), `0de188ff` → **`05750a5120d33570`**, both from
    187 inputs and 157 distinct paths. Four of the push's 20 files are inputs
    (`worker.js`, `builder/build-server.mjs`, `builder/container-room.mjs`,
    `builder/site-freecss.mjs`), the observer proved alive first;
  - the rollback was verified: `git revert --no-commit 7384ddba..0de188ff` in a
    throwaway worktree gives tree `950cd8c3…`, main's own, so a rollback reuses
    `c3cc126e45e93815`;
  - the served `chat.js` read 786,047 bytes, sha256 `e56f1c9f4ffca3da`,
    byte-identical to both trees (`public/` is not in the push).
- **A FAST-FORWARD**: `main` `7384ddba` → **`0de188ff`** at 05:49:22Z, 9
  commits, 20 files (+3,278 / −258). The merged tree is `c2762cbf…`, the
  candidate's own, and the predictor re-run over `origin/main` after the push
  answered `05750a5120d33570` again.
- **DEPLOY 2161 (`36221930265`)**, success, job 05:49:27 → 05:52:15Z
  (**2m48s**):
  - `DEPLOY_ID` `0de***88ff2d3a00d8096b0***f86***6c507aea2bbce4` (each `***`
    a masked `1`), and the gate took over from `7384ddba…`;
  - the image step (**2m02s, 0 `CACHED` lines**) answered `built
    isibi-app-sitebuildcontainer:05750a5***20d33570 (registry answered 404;
    ***87 inputs off ./Dockerfile)`;
  - the drain found no live leases;
  - Wrangler (18s): `No updated asset files to upload`, `Uploaded isibi-app`,
    `EDIT isibi-app-sitebuildcontainer` with `- …:c3cc***26e45e938***5` →
    `+ …:05750a5***20d33570` under `SUCCESS Modified application`, `Applied
    changes`, `Deployed isibi-app triggers`, `Current Version ID:
    c7c5567***-72fa-488f-8994-3d09***a7fe02***`.
- **NO SERVED-FILE CHECK EXISTS FOR THIS DEPLOY**: `public/` did not change. The
  served `chat.js` read the same `e56f1c9f4ffca3da` after it (05:52:49Z), which
  proves only that nothing moved there. Gates **401 / 401 / 401 / 404** at
  05:52:49Z.
- **THE SESSION COULD NOT PRESS IT.** The image rolled, so the session's one
  dispatch attempt waited out the hold. It was made at **06:08:20Z** (from
  `main`, spend `no`, `expect_deploy`
  `0de188ff2d3a00d8096b01f8616c507aea2bbce4`, `expect_image`
  `05750a5120d33570`) and answered **403 Resource not accessible by
  integration**, the `actions: write` wall again. It was not retried, per the
  owner.
- **RUNTIME-CONFIRMED BY THE OWNER'S FREE PRESS, run 33 (`36223626560`, main
  at `0de188ff`, 06:23:55 → 06:24:37Z, canary step 22 s)**. The env block
  reads `CANARY_SPEND: 0`, blank instruction, read_job and restore, and both
  expectations in their own boxes.
  - `build-health 200 deploy=0de188ff2d3a image=05750a5120d33570` and
    `runtime 200 deploy=0de188ff2d3a async=true runner=true`, with the control
    `washhouse-3 async=true`.
  - Every preflight check is `ok`: both readers answered and agree, async and
    runner are true, the Worker is the expected build, and a cold container
    gets the expected image.
  - The zero-cost confirmations pass: both sites get the ASYNC shape, a forged
    replay and a stranger's poll answer 404, and the free job settled in ~6 s
    as `{"ok":false,"escalate":true,"reason":"empty","cost":0}`.
  - `ALL FREE CHECKS PASSED`, balance **91** (unchanged since run 32's end),
    and *"CANARY_SPEND is not 1 — stopping before the paid edit. Nothing was
    charged."*
  - **This is the live Worker answering, not Wrangler reporting on itself**,
    so 2161 is deployed AND runtime-confirmed.
  - **2160's own moment was never read live**, since no press ran between the
    two deploys. What run 33 establishes is that `0de188ff` answers, and every
    commit 2160 shipped is an ancestor of it.
- **AND ITS BEFORE-READ IS TEST 3'S STARTING STATE.** The source read was
  complete (`reads` all true). All three routes answer
  `01790360265159-n7mtnq`. The six bodies in its `before/source.json` are
  byte-identical to run 32's after-read and match every recorded hash, with the
  same path set.
  - The comparator was proved alive both ways: the recorded hashes reproduce on
    run 32's after-read first (6 of 6), and against run 32's BEFORE-read it
    finds exactly `index.tsx` changed, which is the section move.

