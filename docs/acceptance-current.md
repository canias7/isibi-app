# Acceptance: the instructions to follow now

*Current instructions only. They are replaced, never appended to, when they
change. The history of how they came to be, including superseded image ids,
stages and budgets, is in `docs/history/2026-10-11-acceptance-batch.md`,
`docs/history/2026-10-12-acceptance-addon-free.md`,
`docs/history/2026-10-12-acceptance-addon-next.md` and
`docs/history/2026-10-12-acceptance-addon-two-parts.md`; nothing there is an
instruction.*

**As of 2026-10-13, branch `claude/help-needed-ehlwlj`** (§00 is the latest live press). P1 and P2 are done
and closed. **The K0/K/E/M0/M batch (§4) was approved and run on 2026-10-12
(74 credits, balance 876).** Its results are in
`docs/history/2026-10-12-acceptance-addon-two-parts.md` and the owner-notes
handoff, and they supersede §4–§6 as a plan. No further paid tests are
approved.

## 00. The one live `acc-isolation-page` press (approved; done 2026-10-13)

**Run 144**, once, on deploy 2199's code (`fef80b9b`, image
`4444d9d53d906b8d`) with image purchases off (deploy 2200), 23 credits
(860 → 837). The record is `docs/history/2026-10-13-run144.md`.
- The normal router ran the **Add-on first** (the heading held back as its
  own part); versions `bt5fdp` → `i9dk12` (Add-on) → `e07yu1` (Edit).
- **Isolation shown, discriminating, for this run**: every call's marks
  clean (4 Add-on, 1 text); the Add-on's version left the heading exactly as
  found; the Edit only appended " — sent every Friday".
- The one FAIL was the checker's (a section and a heading on one page),
  fixed offline; not re-run.
- Correction reuse not exercised (no refusal).
- **The opt-in is closed again.** Image purchases are back on (deploy 2201,
  runtime-confirmed by run 145, nothing charged). No further paid tests are
  approved.

## 0. The task-isolation release and one live check (approved; done 2026-10-12)

**Result** (`docs/history/2026-10-12-acceptance-addon-two-parts.md`, last
section; `docs/deploy-record.md` 2197 and 2198):
- **Released**: deploy 2197, `main` `64f17488`, image built
  `eda28cb21064287d`, image purchases off; runtime-confirmed by run 140.
- **Run 141** (`acc-isolation`, once, 16 credits exact, 876 → 860):
  both parts finished in their own scope (the Gallery heading "Fresh from
  our ovens"; one questions section on `/bake-list`; nothing else changed).
  - The served-section FAIL is a checker bug (a `>` inside a class
    attribute), proven offline; the page is right.
  - The reuse FAIL is real: the Add-on's overlapped preparation replayed 1
    answer and asked 3 again; the cause is unverified.
  - **Isolation unverified**: the router ran the heading first, so the
    Add-on could not repeat run 137's stray rewrite. Not retried.
  - The other-part markings cannot be read from the traces (no prompts kept).
- **Restored**: image purchases on, deploy 2198 (image reused),
  runtime-confirmed by run 142 (`imagePurchases=true`, balance 860).
- Build flags and limits untouched. No further paid tests.

**Follow-up (2026-10-13, free)**, `docs/history/2026-10-12-run141-followup.md`:
- the reader is fixed;
- there is no scoping defect;
- the reuse cause is inferred, as a refused prepared design;
- the Add-on's `scoped` count is fixed;
- `acc-isolation-page` is prepared (not pressed), to judge isolation in
  either order.

**Evidence round (2026-10-13, free)**, `docs/history/2026-10-13-evidence-round.md`:
- per-call task markings are built;
- the isolation verdict is corrected (marks plus each job's own version;
  "discriminating" only when the Add-on ran first);
- the correction-reuse design is ready for the owner;
- the balance opt-in is closed;
- run 141's preparation record has no read path, so its cause stays
  unconfirmed.

**Correction reuse (2026-10-13, built offline on the owner's word)**,
`docs/history/2026-10-13-correction-reuse.md`:
- on run 141's shape the Add-on job now asks the designer 0 times (skipped
  1, replayed 3, fresh 0), with supplied answers;
- not live: a deploy with a new image is needed before any press could show
  it.

The proposal as approved follows.


**Closed and not reopened**:
- the accordion and branch checker corrections (`6dae03bc`, `b34707e6`);
- every completed parallel-work result: P1, P2, and K, E and M's overlap
  and reuse evidence.

**A free read of the K/M pages with the per-question reader (2026-10-12)**:
- `/visit`: "Can I bring my dog?" → "Dogs are welcome inside."
- `/tasting-evenings`: "How much is an evening?" → "£25 a head, cheese
  included."
- `/order`, `/classes`, `/bakers`: no disclosures.
- **All five reads are complete**: no failed press, no truncation, nothing
  stopped. Every page was at version `01791834312928-ixrvdj`.
- Saved in `docs/history/evidence/2026-10-12-km-open-read/`. Nothing was
  regenerated or submitted.

**What would be released**:
- **Code commits**:
  - `83c9015a`, the isolation fix (`builder/request.mjs`,
    `builder/site-ask.mjs`, `worker.js`);
  - `6dae03bc` and `b34707e6`, the checker (scripts only);
  - `ec7d894c`, the `acc-isolation` scenario, plus the scenario box in
    `.github/workflows/edit-canary.yml`.
- **The merge candidate** is the branch tip, with nothing after `ec7d894c`
  but documents. Preflight confirms that at the time.
- **The container must be rebuilt.** `builder/request.mjs` and
  `builder/site-ask.mjs` are image inputs: `1e30b6fb56b51794` →
  **`eda28cb21064287d`** (205 inputs), predicted on both ends of
  `ec7d894c`. The merge's deploy run builds it. After that, the 15–20
  minute image window before container work.
- **Image purchases off for the press** (`images: "none"`): set
  `IMAGE_PURCHASES` to `off` before the merge, so the merge deploy ships
  both the image and the switch. Then turn it back on with a manual
  redeploy (image reused).
- Build flags and the 1-page / 15-component limits are untouched.

**The request** (`acc-isolation`, fold-lane-bakery), read against the live
site on 2026-10-12:

> *Add a short questions section to the Bake List page answering 'When is
> the list updated?' with 'Every Monday morning.' And change the Gallery
> page heading 'Photographs straight from our ovens' to 'Fresh from our
> ovens'.*

- **It makes real changes.** The Bake List has no questions section and
  says nothing about Mondays. Run 137's heading change landed, so the
  Gallery heading now reads "Photographs straight from our ovens", and
  "Fresh from our ovens" is not on the site.
- **It exercises the original failure.** It is run 137's shape: an Add-on
  part whose page writer sees every page, beside an edit part changing
  another page's heading. The new heading loses the old words, so a stray
  rewrite by the Add-on would trip the `kept` guard exactly as in run 137.

**Estimate: 12–26 credits.**
- routing 2–3;
- the heading 1–3;
- the Add-on 7–15, and its judgment about 1.
- Run 137's comparable parts cost 8 with the Add-on refused, and K's and
  M's Add-on parts cost about 10–13 each.
- The balance is 876, above the 100-credit cap. So the balance opt-in must
  name `acc-isolation`: a one-line change to `BALANCE_OPT_IN` and its form
  description, made only on your approval and before the merge.
- No routing probe is planned. The press records the router's own split;
  see "unverified" below.

**Pass checks** (the press's own verdict, and the runtime check first):
- **Runtime first** (free): both readers on the merged sha, a cold
  container on `eda28cb21064287d`, and `imagePurchases=false`.
- **Both parts finish**, each at an allowed route, with no part failed or
  held. The Add-on is not refused at `kept`.
- **Each stays in its own scope**:
  - `/gallery`'s heading reads "Fresh from our ovens", and nowhere else
    changed;
  - `/bake-list` gained exactly one section stating every asked fact,
    judged opened per question;
  - every other stored page and component is byte for byte as before;
  - no page is added and no table is touched.
- **Prepared work reused**: a part's prepared step overlapped another
  part's job, by the recorded intervals. At least one part that overlapped
  replayed its preparation exactly (`fresh: 0`).
- **Money**: the press's own charges add up, with no charge made twice.
- **The Add-on's model inputs**: read afterwards with the read-job box, the
  free read of the job's trace, to see whether the heading appears only
  inside `⟦ANOTHER PART: …⟧`.

**Unverified unless this shape appears**:
- If the router batches the heading into the Add-on, or does not hold it
  back as its own part, the isolation fix is not exercised. The press
  records that and does not count it as a pass. Run 137's router split it,
  but that was one sample.

**After the press**: set `IMAGE_PURCHASES` back to `on` and redeploy (image
reused), then a free runtime check showing `imagePurchases=true`.

**Separate remaining gaps, not part of this release**:
- concurrency inside one Add-on (K showed two Add-on parts instead);
- the missing-context clarification (`acc-needs`);
- the image-free first Build.

## 1. State

- **Production is deploy 2194** (2026-10-12, 14:41–14:42 UTC): a manual
  redeploy of `main` **`df1dcf30`** that put image purchases back on. Image
  **`1e30b6fb56b51794`**, unchanged. **Runtime-confirmed by run 130** (14:44
  UTC): both readers `df1dcf30f5fb`, a cold container `1e30b6fb56b51794`,
  **`imagePurchases=true`**, nothing charged. `docs/deploy-record.md`.
- **Balance 950.** Option A spent 21: P1 13 (971 → 958) and P2 8 (958 →
  950).
- **P1 and P2 are complete and closed. They are not to be rerun.**
  - **P1** (run 128): the real router's answer for S1–S9. S1, S2 and S9
    were batched; S3–S8 were split into parts.
  - **P2** (run 129, `acc-page-table`): the price part's preparation ran
    beside the heading job (13.1 s, by recorded intervals) and was replayed
    exactly. Both changes landed and nothing else changed. No double charge.
  - The P1/P2 opt-in box (`accept_balance`) admits only those two presses
    and is **not** extended to anything below.
- **Paid acceptance is blocked** for everything else: every acceptance press
  refuses while the balance is above 100 (`ACCEPTANCE_CAP`). The balance is
  950, and nothing here asks for it to change. **No separate test budget
  exists.**
- **Real images are unverified**, and stay so: no test here buys one. fal is
  off limits. **Every case below is image-free.**
- **The account's Build flags are left as they are**, and the 1-page /
  15-component limits are unchanged.

## 2. The goal, and what is proved offline versus live

**The goal**: independent, substantive work runs at the same time across
Build, Edit and Add-on; real dependencies wait; work that succeeded is reused,
not redone, after a question or a restart; nothing is charged twice.

**Offline** means through the real request driver, queue consumer, routes and
job runner, with supplied model answers and no network. Overlap is proved by
a rendezvous: each of two calls is held until the other has started, so a
schedule that runs them one after the other cannot pass. **Live** means a
press against the deployed Worker, with real models.

| Claim | Build | Edit | Add-on |
|---|---|---|---|
| **Independent work overlaps** | Offline: `build-parallel` BLD 1 (photographs bought while the pages are generated; it involves photographs). The image-free overlap by bands or design agents runs only under the `design`, `graph` or `bandsEveryone` flags. Live: **not shown**. | Offline: PC 1–2, `parallel-dispatch`, `parallel-intervals`, `step-pool`. Live: **run 119** (production `f96cbfd5`), a prepared price step inside an executing heading job, by recorded intervals. | Offline, **inside one Add-on**: PI 1 (photo), PI 24 (table and section), **PI 32** (a new page and a section, image-free, new in round 16). Offline, **across parts**: PI 2–3 (photo), PI 29 (an Add-on part beside an Edit part), **PI 33** (two Add-on parts on two pages, image-free, new). Live: **not shown**. |
| **Real dependencies wait** | Offline: `build-parallel` BLD 2 (the build is not handed on while a photograph is out). | Offline: PC 3 (a menu link waits for the page it needs, held mid-call), `parallel-plan`, `parallel-readiness`, `request-plan`. Live: **not shown on the branch**. | Offline: PI 5 (a photo inside the component another part creates), PI 25 and PI 28 (a form waits for the table it saves into). Live: **not shown**. |
| **Results are correct** | Offline: BLD 1–6. | Offline: every case reads the stored pages and rows. Live: run 119's changes landed. | Offline: every PI case reads the stored pages. Live: **not shown** without a photograph. |
| **Success is reused after a question** | Not covered by these files. | Offline: `continuation-unusable`, `validation-reuse`, `live-clarify-*`. Live: **not shown**. | Offline: PI 30–31 (the table's finished design replayed across a question), RS 1–13 (every requirement kept). Live: **not shown**. |
| **Success is reused after a restart** | Offline: BLD 3–4 (a redelivered first run, and a purchase whose buyer died, found and reused), `build-resume`. | Offline: PC 5 (preparation taken again by the cron after a crash), `handover-resume`. Live: **not shown**. | Offline: RC 1 (the same request resumes after a restart, with no new message), PI 21 (the run after a held purchase replays what was finished). Live: **not shown**. |
| **Prepared work is replayed exactly** | n/a | Offline: PC 1–2, PI 29. Live: **not shown** (run 119 predates per-job `prepUse`). | Offline: PI 29, PI 33. Live: **not shown**. |
| **Nothing is charged twice** | Offline: BLD 3–5, `parallel-purchase`, `purchase-outcomes`. | Offline: PC 4 (redelivered preparation), RC 3, RS 12. Live: **not shown on the branch** (run 119 spent 12 on production). | Offline: PI 7 (every message delivered twice), PI 32–33 (unique ledger refs). Live: **not shown**. |

The consolidated offline sweep groups these files: independent work, genuine
dependencies, clarification and resume, partial failure (§6 gives the counts).

**Shown live** (P1/P2, closed): the real router splits a page change from a
table change into parts (P1's S3–S8) and batches changes of one kind (S1, S2,
S9); a part's scoped preparation overlaps another part's job and is replayed
exactly, both changes land, and nothing is charged twice (P2).

**Still needs live verification**, and only a press can show it:

1. **inside one Add-on, two designers running at the same time.** S7 (a page
   and a section) was split into parts, so it cannot show this. S9 (two
   sections) came back as one Add-on, but two sections are one kind and one
   designer, so it cannot either. `acc-addon-kinds` asks for a section and a
   line, which are two kinds that wait for nothing (§4, K);
2. **an Add-on part's preparation replayed exactly beside an Edit part's
   job.** S8 was split into an Edit part and a held Add-on part, and those
   are independent (`acc-addon-edit`, §4, E);
3. **two independent Add-on parts running at the same time** (§4, M), kept
   apart from 2. **Unverified, and possibly not reachable**: it needs the
   real router to hold two additions back as two separate entries, which P1
   never showed (it batched S9's two sections into one Add-on). S7's two
   Add-on parts are **not** independent: the section's picker reads the
   site's page list, which the new page changes, so it waits (PI 35);
4. **subsequent**: whether a real model says `needs` when it lacks context
   (`acc-needs`, one sample at most);
5. **subsequent**: the image-free first Build's overlap by bands or design
   agents (only if `design`, `graph` or `bandsEveryone` is already on);
6. real images (not proposed: fal is off limits).

## 3. The evidence each live claim needs

Every check reads what the run recorded, never a status or a routing answer.

| Claim | Evidence (existing reader) | Passes only when |
|---|---|---|
| **Overlap across parts** | `overlapVerdict` (`scripts/canary-requests.mjs`): the request view's recorded intervals, a part's prepared step (`prepRun`, calls > 0) against another part's job run (`runs`), or two prepared steps together | the intervals intersect; a batched answer or parts run one after another fail, and are recorded as such. **Between two Add-on parts** (`overlap: "addon-parts"`, M): only parts routed `addon` count on both sides, and fewer than two is missing evidence |
| **Overlap inside one Add-on** | **`addonDesignOverlap`** (`scripts/canary-read-job.mjs`), read free afterwards with the *read_job* box on the Add-on's job: the job's `add:<kind>` start and end marks in its trace. The lookup reads **every job on the site whose run touches the window** (created before its end, still updated after the earliest returned trace began), never by a creation lookback | the two designers' intervals cross, **and** the job has finished, the jobs read is complete and holds it, exactly one trace ran inside the job's own run (a trace that began before the job existed is never its), and no other job ran beside that trace. Two traces inside the run or another job beside it: `candidate-only`. A failed or cut read, an unfinished job, a trace without times, or no trace inside the run: `unknown`. Never a pass by default |
| **Correct final results** | `outcomeChecks`: `headings`, `pages`, `menu`, and `sections` (a section added to a page that exists keeps everything that page said, and the served page says it); **every fact the message asked for** (`facts`, `only`, `denies`, round 17): each place, amount, day and time stated, no other amount, day or time beside it, and no claim the customer denied; equivalent wording allowed only from each fact's own list; **judged on the asked section itself, in stored and served output alike** (round 18): only what the press added, one added section holding every fact, any other added section judged for contradictions; every other stored page byte for byte; tables, logos and photographs as they were | every named change and every asked-for fact is there, nothing contradicts them, and nothing else moved |
| **Dependency ordering** | `jobOrderVerdict`: no part started before a part it needs had finished; COVERAGE `waits-for-prerequisite` | the order holds; a press where nothing waited says so (vacuous), never claims it |
| **Reuse** | `reuseVerdict`: per-job `prepUse` (`exact` = staged yes, replayed ≥ 1, fresh 0) | the demanded number of jobs answered exactly from prepared work; a missing record fails |
| **No duplicate charges** | `moneyVerdict`, `ownMoneyVerdict` (the press's own ledger rows), `laterChargesVerdict` (charges after the request ended), and the read-job ledger (`credit_events` by job id) | each job reserved once, every ledger ref distinct, nothing charged after the end, spend within the estimate |

## 4. The execution proposal (prepared, not pressed)

One proposal for everything still open on the Add-on side. Built on P1's real
routing results, with nothing forced and no product behaviour changed. Each
press records what the router and the picker actually did; a claim the run
did not reach is recorded as not reached, never passed. P1 and P2 stay
closed.

### The exact requests

| # | Press | The exact words sent | Estimate |
|---|---|---|---|
| K0 | routing probe `acceptance-split-2` (applies nothing) | *Add a short questions section to the Visit page answering 'Can I bring my dog?' with 'Dogs are welcome inside.' And add one line under the collection times on the Order page saying 'Every loaf is baked the morning you collect it.'* | 1–3 |
| K | `acc-addon-kinds` | the same words as K0 | 9–19 (budget 22) |
| E | `acc-addon-edit` (S8) | *Add a short questions section to the Bake List page answering 'When is the list updated?' with 'Every Monday morning.' And change the Gallery page heading 'Photographs from our ovens' to 'Photographs straight from our ovens'.* | 9–20 (budget 22) |
| M0 | routing probe `acceptance-split-3` (applies nothing) | *On the bakers page, change the heading 'Who mixes while Bristol sleeps' to 'Who mixes while the city sleeps'. Also add a short questions section to the Tasting Evenings page answering 'How much is an evening?' with '£25 a head, cheese included.' And add a short note to the Classes page saying 'Classes are for ages 12 and up.'* | 1–3 |
| M | `acc-addon-two-parts` | the same words as M0 | 17–37 (budget 40) |

**Total: about 37–82 credits** if all five run. If K0 or M0 rules its case
out, that case is not pressed: K0 + E + M0 alone is about 11–26. These are
estimates, not limits. Every page each press touches is its own: K `/visit`
and `/order`, E `/bake-list` and `/gallery`, M `/bakers`, `/tasting-evenings`
and `/classes`. Their words were read off the live pages on 2026-10-12 as not
there yet.

### What makes each case eligible (read from the probe's saved answer)

- **K** only if K0 is **one `addon` answer with nothing held back**. Split
  into parts, K is not pressed.
- **E** needs no probe: P1 already showed S8 as an Edit part and a held Add-on
  part.
- **M** only if M0's answer (`routing-probes.json`, the whole route answer) is
  all of these:
  - an **edit** answer (`text`, or `look`) for the heading;
  - `alsoAsked` holds **both** additions, **as two separate entries** (the
    live router's field is a list, "one entry for each" separate request);
  - in `targets`, change 1 writes only `page:/tasting-evenings` and change 2
    only `page:/classes` (each may add a new component, but not the same
    one), and neither reads anything;
  - `dependsOn` names no relation between them.

  **Not eligible**, so M is not pressed and case 3 stays unverified:
  - one `addon` answer for both additions (S9's shape; one kind, one
    designer, nothing to overlap);
  - both additions held back as **one** entry;
  - the same new component named for both, or any target outside the
    addition's own page (the menu, a new page, the whole site);
  - a relation between the two;
  - a question back.

### Why M's two Add-on parts can overlap: their read/write dependencies

From the code, not assumed:
- Each held addition whose writes all land on one named page is **scoped**
  to it (`addonScope`). Its preparation then reads only `pagelist`, `theme`
  and its own page (`stepInputs`).
- What each writes:
  - the heading's text job: only `page:/bakers`;
  - the Tasting Evenings section: only `page:/tasting-evenings` (and its new
    component, if named);
  - the Classes note: only `page:/classes` (and its own component).
- None of the three writes a new page, the page list or the theme. No part
  writes what another reads. So `clearToPrepare` holds neither addition for
  the heading or for the other. Both are prepared beside the heading's job,
  and beside each other.
- The same new component named for both would conflict, and the second
  would wait. A new page would feed the page list, and the addition would
  wait, as S7's did (PI 35).
- **Offline**: PI 36 runs this exact shape through the real route with
  supplied answers. Both Add-on parts are prepared beside the heading's job,
  their designers meet (a rendezvous that a one-at-a-time schedule cannot
  pass), and both jobs replay their preparation exactly. A free test checks
  the same rules with `clearToPrepare`, including the two controls that make
  it wait.

### The evidence each press must show

| Claim | K | E | M |
|---|---|---|---|
| **Actual overlap** | the free *read_job* press on its Add-on job: `addonDesignOverlap` says `overlapped` (the two designers' recorded intervals cross, the only job and trace on the site in the window) | `overlapVerdict`: the held Add-on part's prepared step (with model calls) crosses the heading job's run, by recorded intervals | **`overlapVerdict` limited to parts routed `addon`** (new in this round): two Add-on parts' prepared steps cross each other, or one Add-on part's prepared step crosses the other Add-on part's job. An Add-on part beside the heading's job does **not** count |
| **Correct results** | `sections`: every asked fact on `/visit` and `/order`, stored and served (dogs welcome inside; every loaf baked the morning you collect it, no other time of day, never "the night before"); every other page byte for byte | the Gallery heading; every fact on `/bake-list` (updated every Monday morning, no other day or time); nothing else moves | the `/bakers` heading; every fact on `/tasting-evenings` (£25 a head, cheese included, no other amount, never "cheese extra") and `/classes` (ages 12 and up, never "all ages"), stored and served; every other page byte for byte |
| **Reuse** | none demanded (one job) | `reuseVerdict`: at least 1 job answered exactly (staged yes, replayed ≥ 1, fresh 0), by a part whose step overlapped | `reuseVerdict`: **both** Add-on parts' jobs answered exactly, and at least one of them is a part whose step overlapped **another Add-on part's** work |
| **Charges** | each job reserved once; ledger refs distinct; nothing charged after the end; spend within budget | the same | the same |
| **Images** | none bought: the press refuses unless the runtime reports image purchases off | the same | the same |

M also records the router's real shape (`shape`) and the coverage
`addon-parts` (two finished Add-on parts). Neither is a pass on its own.

### Order

K0 and M0 first (routing only). Then K (if K0 allows it), E, and M (if M0
allows it), one at a time. Each compares against its own before-read.

**Subsequent, not in this batch**: `acc-needs` (the missing-context
clarification) and the image-free first Build.

## 5. The spending decision this proposal needs

**What is enforced**: the server refuses any charge the balance cannot cover,
so the only enforced bound on a paid press is the whole balance (950). No
per-press cap exists on the server. The presses' 100-credit refusal blocks
K0, K, E, M0 and M at 950. **The P1/P2 opt-in does not cover them, and is not
extended here.**

Before anything is pressed, choose one:
- **A2.** Accept the balance as the bound for exactly these five presses.
  This needs one small, reviewed change: an opt-in for these five, like
  P1/P2's. Their worst case is the whole balance.
- **B.** A separate test budget first (a billing change), with the presses
  blocked until it exists.
- **C.** Nothing live. Items 1–3 stay shown offline only (PI 34, PI 29,
  PI 36).

**Not an option**: lowering or resetting the account's balance.

## 6. The steps from here (each the owner's)

1. Review this proposal and choose §5's option.
2. For A2: review and merge the opt-in. The scenarios exist on the branch,
   and a press can run from the branch, so no deploy is needed for them.
   Merging the workflow file starts a deploy run, with the image reused.
3. **K0 and M0** (routing only; image purchases need not be off for them):
   run edit canary with *ROUTING-ONLY BATCH* = `acceptance-split-2`, then
   again with `acceptance-split-3`, spend `yes`, and the deploy sha and
   image boxes. I read each saved answer against the eligibility rules above.
4. **Image purchases off**: set `IMAGE_PURCHASES` to `off` and re-run the
   deploy workflow. The free runtime press must then show
   `imagePurchases=false`. **This stops photographs for every customer while
   it is off**, so keep the window short.
5. **K** (only if K0 allows it): *The site to edit* = `fold-lane-bakery`,
   scenario `acc-addon-kinds`, spend `yes`, the deploy and image boxes. Then
   the free *read_job* press on its Add-on job, for the `DESIGNERS` line.
6. **E**: the same boxes, with scenario `acc-addon-edit`.
7. **M** (only if M0 allows it): the same boxes, with scenario
   `acc-addon-two-parts`.
8. **Image purchases back on**: set `IMAGE_PURCHASES` to `on` and re-run the
   deploy workflow. The free runtime press must show `imagePurchases=true`.

## 7. Offline verification of this plan (rounds 16 to 18)

- Round 16: harness commit `8db3cbea`; full suite `10650 / 10650 / 0 / 0`;
  acceptance sweep 524 / 524; sweep 14 of 14; CI unit tests 38198232545
  `success`.
- Round 17 (`docs/history/2026-10-12-acceptance-harness-controls.md`):
  commit `1eac62c1`, after Codex's controls on `3869478b`. Every asked-for
  fact is judged, and trace attribution goes by run. Full suite `10657 /
  10657 / 0 / 0`; acceptance sweep 41 files, **531 / 531**; sweep 21 of 21,
  control surviving; red check 9 of 16 failing on `3869478b`; CI unit tests
  38201146344 `success` on `1eac62c1`.
- Round 18 (`docs/history/2026-10-12-acceptance-served-sections.md`):
  commit `d9434979`, after Codex's control on `2015cc0c` (a section served
  with an added "£50 a head" passed). The asked section is judged whole, on
  stored and served output alike, on what the press added only. Full suite
  `10663 / 10663 / 0 / 0`; acceptance sweep 41 files, **537 / 537**; sweep
  13 of 14 (1 equivalent), control surviving; red check 5 of 22 failing on
  `2015cc0c`; CI unit tests 38236080782 `success` on `d9434979`.
- **Closed** (2026-10-12): Codex reviewed `dc3ea241`. 212 focused tests
  passed, three browser-dependent tests were skipped, both independent
  served-price controls passed, and CI was green (unit tests 38237458207
  `success` on `dc3ea241`). The acceptance-harness repair batch is closed.
  Nothing completed is to be repeated without a concrete reason.
- **After P1/P2** (`docs/history/2026-10-12-acceptance-addon-next.md`):
  - `acc-addon-kinds` and its one-message probe `acceptance-split-2` were
    added.
  - PI 34: two kinds in one Add-on with no `uses` meet.
  - PI 35: S7's parts wait, the section is not prepared beside the page, and
    its job works afresh.
  - S7's scenario is left as reviewed and marked not proposed.
  - No product code changed.
- **Two independent Add-on parts**
  (`docs/history/2026-10-12-acceptance-addon-two-parts.md`):
  - `acc-addon-two-parts` and its one-message probe `acceptance-split-3`
    were added.
  - The overlap reader can be limited to Add-on parts, and the scenario
    demands that limit.
  - PI 36 is the shape offline: two held additions on two pages beside a
    heading, prepared together and replayed exactly.
  - No product code changed.
