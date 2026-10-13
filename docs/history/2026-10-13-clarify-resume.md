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
| `imagePurchases` at runtime | **not yet read** | see below |

**The runtime flag needs the owner's free press.** A green deploy does not
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

> Change the Classes page heading 'How a Saturday class runs' to 'How a
> Saturday class works', add a link to our online shop in the footer, and
> once that shop link is in, add one line on the Order page saying you can
> also order online from our shop, using the link at the bottom of every
> page.

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
- **Pass** only on the full shape above.
- **Not exercised, named by stage, never a pass, never retried:** no
  question, the asking part not waiting, nothing finished first, or nothing
  held on the asking part.
- **Fail:** the held part ran early, a finished part ran again, the asking
  part was not resumed, the held part never ran, or a part is not done.
- **Unverified:** a view that was never read.

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
