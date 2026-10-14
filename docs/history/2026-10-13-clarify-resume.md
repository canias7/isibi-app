# After run 150: the free follow-up, and one consolidated clarify-and-resume test, prepared (2026-10-13)

Codex reviewed `07424a78` and checked run 150's logs independently. Inside
one Add-on, the component and words designers overlapped for about 67 s,
both changes landed, and the run charged exactly 20 credits with no image
purchase. **The owner closed that live coverage gap: K3B is not repeated.**

The owner then asked for:
- a free follow-up;
- a clean handoff;
- one consolidated, image-free clarification/resume test, prepared and
  not run.

**Nothing was spent, merged, deployed or built in this round.** No paid
call, image or fal call, and no container build. Main stays `fef80b9b`.
The reporting change `62bbd81b` stays unmerged. Its evidence is offline
only and is kept apart from the production evidence below.

## 1. The free follow-up

| Reading | Value | How it was read |
|---|---|---|
| Deployed Worker | `fef80b9b` (deploy 2203, green; run 38476539324) | the deploy run |
| Container image | `4444d9d53d906b8d`, reused by 2202 and 2203 | the deploy log's `reused` line |
| Balance | **808** (last ledger row 459, run 150's Add-on reserve, 21:59 UTC; nothing after it) | `credit_events`, non-secret columns |
| Open jobs | none (two September `fretwork-1` rows are `lost`) | `edit_jobs` |
| Paid opt-ins | **closed**: `BALANCE_OPT_IN = []` at `07424a78`, and the form's balance box reads "CLOSED" | the branch |
| `imagePurchases` at runtime | **`true`**, confirmed by run 151 (23:37 UTC, free, from `1c14b10d`) | the preflight's runtime line: `deploy=fef80b9bc913 async=true runner=true imagePurchases=true`; build-health `image=4444d9d53d906b8d` |

**Confirmed by run 151** (the owner's free press, 2026-10-13 23:37 UTC): both deploy readers answered `fef80b9bc913`, a cold container got `4444d9d53d906b8d`, async and the runner were on, `imagePurchases=true`, the free job settled at cost 0, the balance read 808, and the run stopped before the paid edit. *Before it:* **the runtime flag needed the owner's free press.** A green deploy does not
establish it. The only reader is `/api/site/runtime`, which needs a
signed-in owner, and minting or reading an owner credential is not allowed.
A plain free canary press reads it in its preflight, which runs before any
spend gate (`scripts/edit-canary.mjs` line 474): `imagePurchases=true` is
the confirmation. The boxes are in the owner-notes handoff.

## 2. What the clarify-and-resume test is for

The owner's list, with what already existed before this round:

| What must be shown | Offline before this round | Live before this round |
|---|---|---|
| Independent work continues while another part genuinely needs an answer | C2, CC 3, P4, PI 30 | Run 119: other parts were prepared beside the asking part's work, but its question came **last**, after they had finished |
| Dependency-bound work waits | C2 (statuses), B1, P2, PI 5 | none: nothing in run 119 depended on the asking part |
| Answering resumes only the waiting part | C2, CC 3 (never run or charged again), PI 30 | runs 119 and 99 (one waiting part, nothing else open) |
| Successful work survives reload/reconnection | E2 (another device finds the request and question), CC 3 | run 119 (answer sent with the tab closed, followed in a fresh session) |
| No duplicate execution or charges | I4 (answer resent), CC 6, A1-style ledger checks | `ownMoneyVerdict` on every press |

**The uncovered risk offline** was all of these on one request, with jobs
and money counted across the question, a reconnection mid-wait, the
answer, a resend and a reload. **Live**, nothing has shown work continuing
after a question was asked, or a part held on the asking part.

## 3. The offline cases added (`test/request-flow.test.mjs`, CR 1–2)

One routine, run over two shapes so that no task type or stage is special:

| Case | Asking part | Independent part | Held part |
|---|---|---|---|
| **CR 1** | an edit's **step** (the description lane) | an addition (a new page) | an edit of the Visit page |
| **CR 2** | an addition's **routing** | an edit (the description) | an edit that needs the addition |

**What each checks, on the real request driver, routes and job runner, with
supplied model answers:**
1. **At the question:**
   - the asking part is waiting, the independent part is done, and the held
     part is blocked with no job;
   - the asking part changed nothing;
   - the independent change is on the site, and the held part's page is
     untouched.
2. **Reconnection while it waits:**
   - another device lists the same request, the same states and the
     question on its part;
   - the question route names that part;
   - reading runs nothing and charges nothing.
3. **The answer:**
   - every part ends done;
   - the independent part keeps exactly the jobs it had;
   - the asking part files a new job;
   - the held part runs only now, each step once.
4. **The money:**
   - one routing row for the message and one for the answer, each by its
     own key;
   - no job reserved twice, and every job that worked after the answer, and
     the independent part's job, reserved exactly once;
   - no refund, and the balance moved by exactly those rows;
   - an edit step that only asks takes nothing (existing behaviour, now
     stated).
5. **The same answer resent:** refused (`stale-question`), nothing run or
   charged.
6. **A reload afterwards:** the ended request is listed with every part
   done; nothing reruns.

**Mutants on the readiness rule (`builder/request.mjs`),** restored by file
copy, with no commit while they ran:
- a dependent part not waiting for what it needs: **killed** (CR 1, CR 2
  and C2 fail);
- a waiting part counted as complete: **killed** (the same three).

## 4. The live scenario, prepared, not pressed (`acc-clarify-resume`)

**The exact request**, one message on `fold-lane-bakery`:

> Add a link to our online shop in the footer, change the Classes page
> heading 'How a Saturday class runs' to 'How a Saturday class works', and
> once that shop link is in, add one line on the Order page saying you can
> also order online from our shop, using the link at the bottom of every
> page.

(Reordered on 2026-10-13 after Codex's review, §7: the shop link comes
first, so its write is filed first and the heading's can come after the
question.)

**Then the answer**, sent with the tab closed and followed in a fresh
browser session:

> It's shop.harbourloaf.co.uk/bread

**Why these targets** (read free from the live pages, 2026-10-13):
- No page says "online" or "shop", and no footer links a shop. Every
  supported social network is already linked, so a social link could not
  ask.
- The Classes page has the heading "How a Saturday class runs". Its other
  heading belongs to lv-progress's history and is guarded.
- The three parts are three kinds, and nothing is special-cased:
  - an edit that needs nothing;
  - a footer link whose address is genuinely unknown;
  - a line that refers to what the link part makes.

**Expected observations** (all from the press's own record; the verdict
reads no wording):
- **The routing:** one request of three parts. The routing answer says the
  line needs the link (`dependsOn`).
- **At the question:** the heading part is `done`, the link part is
  `waiting` with its question, and the line part is `blocked` with no job.
- **The timing (§7):** in the press's own timed reads, the heading part is
  seen running, or seen finishing, after the link part was first read
  waiting and before the answer was sent.
- **After the answer:**
  - every part is `done`;
  - the heading part has exactly its earlier jobs;
  - the link part filed a new job;
  - the line part ran only after the answer.
- **Outcome:**
  - the Classes heading reads "How a Saturday class works";
  - every page's footer gained the shop link to
    `shop.harbourloaf.co.uk/bread` and kept every link it had;
  - `/order` gained one line saying "online" and "shop".
- **Preservation and money:**
  - everything else is byte for byte;
  - the press's own charges add up to the balance's move;
  - nothing is charged later.
- **Recorded, not judged:** the router's shape.

**The verdict** (`clarifyResumeVerdict`, `scripts/canary-requests.mjs`):
- **Pass** only on the full shape above, the timing included.
- **Not exercised, named by stage, never a pass, never retried:** no
  question, the asking part not waiting, nothing finished first, nothing
  held on the asking part, or (stage `timing`) the work finished before the
  question.
- **Fail:** the held part ran early, a finished part ran again, the asking
  part was not resumed, the held part never ran, or a part is not done.
  A failure is a failure whatever the timing.
- **Unverified:** a view that was never read, or (stage `timing`) a trail
  that cannot tell when the question began waiting or what ran after it.

**Tests** (`test/acceptance-clarify-resume.test.mjs`, CRS 1–6): the
scenario's guards, pass, six not-exercised shapes, five failures,
unverified, and the wiring. **Sweep:** 9 of 9 killed; the control survived.

**Estimated cost: about 10–19 credits** (budget 20; an estimate, not a
cap):
- routing for the message 3;
- the heading 2;
- the link's routing 1–3 and its step 1–2 (an edit step that only asks
  takes nothing);
- the line's routing 1–3 and its step 1–3;
- the answer's routing 1–3.

**What it needs, for one run:**
1. **The owner's one-time balance opt-in** naming `acc-clarify-resume`
   (808 is above the 100-credit cap).
2. **`IMAGE_PURCHASES` off and a redeploy of `main`**, as for runs 144 and
   150 (the acceptance preflight requires it); then on again.
3. **The owner's press**, after the free runtime check above.

## 5. Limits

**Live-only, not run:**
- whether the real router names the dependency;
- whether the link's question comes from its routing or its step (the
  verdict accepts either);
- whether the line asks a question of its own.

If the line asks for the address too, the press answers only one question.
The line is then left waiting, and the press **fails** at resume rather
than passing.

**Reconnection, live:** the answer is sent from a closed tab and the press
follows the request in a fresh session. A second device reading the
waiting question is shown offline only (E2, CR 1–2).

**Duplicate charges, live:** read by `ownMoneyVerdict` (one row per job's
own ref). A job that only asks is free by design, so "one charge per job"
is the checked rule for jobs that worked.

**The reporting change** (`62bbd81b`, per-addition observations) is not
deployed, so its effect on these replies is not shown live.

## 6. Suites

- focused: `request-flow` 72 of 72 (CR 1–2 new), `acceptance-clarify-resume` 6 of 6, the canary and acceptance files 702 of 702 (one historical guard made the first chosen heading unusable; it was retargeted);
- **full suite `10808 / 10808 / 0 / 0`** (10,800 + CR 1–2 + CRS 1–6).

Image: no builder module changed in this round, so a release would still build `0e06c1826e3c3c00` (from `62bbd81b`); production stays `4444d9d53d906b8d`.

## 7. Codex's false pass, and the timing correction (2026-10-13, after `4d60a2a3`)

**What Codex reproduced.** The independent job ran from 100 to 200. The
asking job started at 300 and asked at 400. The verdict at `4d60a2a3` still
returned **pass**: it read only a snapshot of statuses at the question
(done / waiting / blocked), and a snapshot cannot tell work done before the
question from work done while it waited. That is the timing limit already
recorded for run 119, repeated. So the open gap was not closed: **nothing
showed independent work continuing while a question waited.**

**The correction, evidence and verdict together** (scripts and tests only;
no builder file changed, so the image is unchanged):
1. **The press records when.** Each read of the request view in the trail
   (`noteView`, every 3 s while a message is followed) now keeps each part's
   job count beside its status, and a read is added when either changes. Each
   read already carried its time.
2. **The wait's start** is the first read in which the asking part is
   `waiting`. It began after the read before it, and by this one. The
   request view does not expose the question's own time (`question.at` is
   kept internally), and exposing it would be a builder change, so the
   press's own reads bracket the start.
3. **Work while it waited** (`waitedWork`, `scripts/canary-ui.mjs`) counts
   only in a read in which the asking part is still waiting, at or after
   the wait's start:
   - `running`: another part is `queued` or `started` there;
   - `finished`: it is `done` there, it was not done in the read before,
     and that read also showed the asking part waiting.

   A part already `done` at the wait's start did its work before the
   question and counts for nothing. Held parts never count.
4. **The answer stays unsent** (`waitHold`, used in the step that ends on
   the question) until one of these happens:
   - that work is seen (`observed`);
   - nothing other than the asking part can still move on its own
     (`settled`: nothing ready, queued, started, recovering or unverified);
   - the step's window ends (`window`).

   The release reason is kept on the record (`request.release`).
5. **The verdict** keeps every earlier check (dependency, resume, reuse of
   finished work), and the money stays `ownMoneyVerdict`'s. It then adds the
   timing:
   - a trail that cannot tell is **unverified** (`timing`);
   - work only before the question, or work only by a part not done by the
     answer, is **not exercised** (`timing`), and no repeat follows;
   - **pass** only with work seen inside the wait, by a part done by the
     answer.

   A resume failure is still a failure, whatever the timing.

**The scenario.** The shop link now comes first. The request files one write
at a time, in message order where nothing depends on anything else. It files
the next ready part's write once the one before is waiting. So the heading's
write is filed after the link asks. Order alone proves nothing, so the
verdict still reads the trail.

One path still gives the wrong timing, and it is judged not exercised:
1. The link's routing does not ask.
2. While its step is still being prepared, the heading is ready.
3. The request files the heading first.
4. Its question then comes after the heading finished.

**What the test now proves, if it passes live:**
- the heading's work was seen running or finishing after the link's
  question was first read waiting, and before the answer was sent;
- the line was held on the link with no job until the answer;
- the answer resumed only the link;
- the heading never ran again;
- every part ended done;
- one charge per job.

**What it does not prove:**
- the question's server-side time (only the press's reads bracket it,
  every 3 s);
- whether the work was on another machine or concurrent within one job;
- anything beyond one sample.

**Tests** (`test/acceptance-clarify-resume.test.mjs`, now CRS 1–12):
- **CRS 7, negative control, Codex's sequence:** heading 100–200, link from
  300, asking at 400. It is **not exercised (`timing`)**, though the same
  snapshot passed before; so are three more shapes:
  - the heading done in the first waiting read;
  - the heading finishing between the same two reads as the wait's start;
  - the heading running only while the link was not waiting.
- **CRS 8, negative control, missing timing:** **unverified (`timing`)**,
  never a pass and never "not exercised", for:
  - no trail, or an empty one;
  - the link never read waiting;
  - a read without a time;
  - reads out of order;
  - a read after the wait with no statuses.
- **CRS 9, positive control:** each of these passes:
  - the heading started inside the wait;
  - the heading queued inside the wait;
  - the heading finished inside the wait.

  Work only by a part not done by the answer does not pass.
- **CRS 10:** `waitedWork` and `waitHold` directly.
- **CRS 11, end to end through the real driver** (the held-app stand-in,
  offline):
  - the heading running while the link waits is released `observed` and
    passes from the trail the press wrote;
  - Codex's sequence through the same driver is released `settled` and
    judged not exercised (`timing`).
- **CRS 12, the hold:**
  - a heading still `recovering` when the question is shown holds the
    answer until a later read shows it done;
  - a heading that never moves is answered at the window's end (`window`),
    and the verdict does not pass.
- **CRS 2–6:** the existing cases, moved to the new part order. CRS 4's
  failures are checked under both timings.

**Red check:** on `4d60a2a3`'s verdict, the new tests fail 6 of 12 (CRS 2, 6,
7, 8, 9 and 11), and Codex's sequence passes there.

**Sweep:** 21 mutants, 20 killed; the comment-only control survived. The one
survivor is equivalent: it removes the verdict's own `held` exclusion,
which the done-by-the-answer filter already covers (a held part is
`blocked` at the question; its early job is a failure, CRS 4). The first
sweep found a real gap: a part finishing across a read in which the asking
part was not waiting counted as `finished`. That rule now requires both
reads to show the asking part waiting. The case is in CRS 7, and its mutant
is killed.

**Cost:** unchanged, **about 10–19 credits**. The same three parts and the
same answer are sent; only their order in the message changed. Holding the
answer adds reads only, which are free.

**Suites (after the correction):** `acceptance-clarify-resume` 12 of 12;
**full suite `10814 / 10814 / 0 / 0`** (10,808 + CRS 7–12).

## 8. The run, pressed (2026-10-14): run 152

**Approval and set-up:**
- The owner: *"I authorize one acc-clarify-resume run at the estimated
  10–19 credits, with no paid images or automatic repeats. Open the opt-in
  for this scenario only."*
- The balance box was opened for `acc-clarify-resume` alone (`39269cea`).
- The owner set `IMAGE_PURCHASES` off and redeployed `main`: deploy 2204
  (run 38488911563, 00:13 UTC, green, `fef80b9b`). Image
  `4444d9d53d906b8d` was reused, with no container changes.
- **The off state, confirmed by the press itself:** its image gate printed
  "the live Worker buys none (IMAGE_PURCHASES off)" before anything was
  sent. No photograph was bought.

**Run 152** (run 38489594737, 00:20–00:39 UTC, from the branch at
`39269cea`, on `fold-lane-bakery`). The balance was 808, exactly the value
allowed. One run, not repeated.

**The real router's shape.** One request of three parts, with the order
`dependsOn [{change: 2, after: [0]}]` (the line waits for the link):
- part 0, the footer link (`addon`, handed by the Add-on step to the menu
  step, `nav`);
- part 1, the heading (`text`);
- part 2, the Order line (blocked; later an `addon`, words).

**The timing, from the server's own job times (UTC):**

| When | What |
|---|---|
| 00:22:21 | Message routed, 3 credits (ledger 460) |
| 00:22:22–00:22:46 | Part 0's Add-on job `b0257dfa…` hands over to the menu step, 0 credits |
| 00:22:47–**00:23:30** | Part 0's menu step `82c4b540…` **asks** "What is the web address of your online shop?", 0 credits. **The question waits from here.** |
| 00:23:30–00:23:40 | Part 1's routing job `a966acb9…`, 3 credits (ledger 461) |
| 00:23:41–00:26:24 | Part 1's edit `40f77850…`: the heading changed and **published at 00:26:15**, 2 credits (ledger 462) |
| 00:26:55 | The answer, sent from a closed tab and followed in a fresh session, is routed (`resumes` part 0), 1 credit (ledger 463) |
| 00:26:56–00:27:56 | Part 0's Add-on hand-over `596d31c9…`, 0 credits |
| 00:27:57–00:31:09 | Part 0's menu step `9dd61506…`: "Online shop" added to the footer on 11 pages, published at 00:30:54, 1 credit (ledger 464) |
| 00:31:10–00:32:17 | Part 2's routing `91a3ddc7…`, 3 credits (ledger 465). **Its first job, only now** |
| 00:32:18–00:36:59 | Part 2's Add-on `e229a0d0…`: the Order line, published at 00:36:47, 12 credits (ledger 466) |

**The five things the owner asked for:**
1. **Independent work while the question waited: shown.** The heading's
   whole run, from 00:23:30 to 00:26:24 (routing, edit and publish), came
   after the question was asked at 00:23:30 and before the answer at
   00:26:55. Its preparation's progress lines came earlier, and they count
   for nothing.

   The press's own verdict (`clarifyResumeVerdict`, with the timing
   correction) said **ok**: work was seen in its timed reads after the link
   was first read waiting, and the answer was held until then. The trail's
   `waitFrom`, `during` and `release` values are in the run's evidence
   bundle, which this session cannot download; the log prints the passing
   check, not the values.
2. **The dependent part stayed blocked until its prerequisite finished.**
   - Part 2 was `blocked` with no job at the question.
   - It was queued at +279 s, after part 0 was done.
   - Its first job (00:31:10) came after part 0's publish (00:30:54).
   - The press's "no part started before a part it needs had finished"
     check: ok on both messages.
3. **The answer resumed the right part:** the routing answer said
   `resumes {part: 0}`; part 0 filed new jobs, and part 1 filed none.
4. **Finished work was reused:** part 1 has exactly its two earlier jobs
   after the answer, and nothing reran it.
5. **No duplicate execution or charges:**
   - seven ledger rows (460–466), each by its own ref, each once, no
     refund, 808 → 783 = 25;
   - the press's money check says the balance moved exactly its own
     charges;
   - nothing was charged later (read 60 s after);
   - no job is open (read afterwards);
   - the jobs that only asked or handed over charged nothing.

**Outcome on the site:**
- `/classes` reads "How a Saturday class works" (served).
- `/order` gained "You can also order online from our shop, using the link
  at the bottom of every page." It keeps everything it said and its
  photographs.
- **Every served footer links to `https://shop.harbourloaf.co.uk/bread`,
  labelled "Online shop"** (read free afterwards, on `/`, `/classes` and
  `/order`).
- No page was added or removed, every component and table is unchanged,
  every page still serves 200, and every header draws the same logo.
- Console errors: 0. The replies were all the model's own and on screen.

**Why the press says FAIL overall (three checks, none of them in the
clarify verdict):**
1. **"every page's footer gained the website link … kept every link it
   had": FAIL.**
   - The menu step put the shop link in the footer's small print, as a
     `site-link` beside the copyright line.
   - The scenario's stored check (`social`, network `website`) looks for
     it in the social-icon list, where it found nothing (`gained []`).
   - The served check, "every served footer links to
     shop.harbourloaf.co.uk/bread", is **ok**.
   - So this is a placement the scenario did not expect, not a missing
     link.
2. **"every stored page is byte for byte as it was, apart from the named
   changes": FAIL.**
   - It names 10 pages, plus `classes.tsx` "beyond that heading". Those are
     exactly the 11 files the menu step reports changing ("Added 'Online
     shop' to the footer's small print on 11 pages").
   - The check counted that footer edit as unexplained because check 1 did
     not recognise it.
   - Whether anything else changed in those files is **not shown**: the
     stored before/after sources are in the evidence bundle, not the log.
     **Preservation outside the footer is unverified for those pages.**
3. **"spent no more than its estimate of 20": FAIL, and a finding.**
   - It spent **25**, against the prepared estimate of 10–19.
   - The Order line went through the Add-on step, as words, at 12,
     instead of an edit at 1–3.
   - Only the balance bounded it.

**What this run proves:** one live sample of a real question waiting
while independent work ran to completion and was published. The dependent
part was held until its prerequisite finished. The answer resumed only the
asking part, finished work was not redone, and every charge was single and
attributable. Coverage: `several-parts`, `step-question`, `answer-resumes`
and `waits-for-prerequisite` are all covered.

**What it does not prove:**
- byte-for-byte preservation of the 11 footer-edited pages (not readable
  here);
- whether the stored footer check should accept a small-print link (a
  scenario question, not changed after the run);
- any rate (one sample).

**Afterwards:**
- The balance box was closed in the commit after this record.
- Image purchases back on: the owner's step, then a free check (§9 when
  read).
