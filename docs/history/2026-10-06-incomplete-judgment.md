# A judgment that does not finish is asked once more, then stops the addition (2026-10-06, on the branch)

The owner, after passing the requirement/evidence correction
(`2026-10-05-judgment.md`):
*"The previous requirement/evidence correction passes review, and required CI
is complete. Keep the branch unmerged and close the incomplete-judgment gap
without expanding this audit. I reproduced an explicit request, "Add a signup
form and send a confirmation email to each person who signs up," with a
grounded email requirement: runJudge accepts {verdicts:[]} as failed:false
with no invalid entries; applyVerdicts leaves it unjudged, and
requirementNote with judged:true returns an empty string. The worker
continues because it checks failed/ask, so a genuinely requested part can
disappear from handoffs and customer reporting. Require a valid verdict for
every submitted requirement before proceeding, both before handoffs and at
the final judgment. Treat missing or malformed coverage as incomplete model
output: recover within the existing bounded policy or use the existing
failure path before applying or publishing anything. Do not ask the user to
repeat an already-clear request because an internal model answer was
incomplete. Keep legitimate "unsure" judgments distinct from missing
judgments, and preserve optional/unrelated classification and
applied-capability checks. Add focused route tests for empty, partial and
invalid verdict lists with explicitly requested features, asserting no
silent omission, premature application or duplicate charging; retain
successful complete-answer controls. Preserve the three earlier corrections,
push evidence and required CI, and update the handoff including
judgment-call cost estimates. No merge, deployment, container image build or
paid retest yet."*

**The fix is on the branch only** (`4b6271ff`): not merged, not deployed, no
image built, nothing pressed or spent. It is shown with supplied model answers through the
real Worker route, not live.

## 1. The reproduction

The owner's chain reproduced exactly before anything changed, at the module
(free, no model call): the requirement *"Each person who signs up is emailed
a confirmation"*, quoting *"send a confirmation email to each person who
signs up"*, survived the grounding; `runJudge` given `{ verdicts: [] }`
answered `failed: false` with no invalid entries; `applyVerdicts` left it
unjudged; and `requirementNote` with `judged: true` returned `""`.

Reading the same path for every other way an answer can leave a requirement
without a verdict found four more, each with the same end:

- **a partial list** — the requirement it did not mention was unjudged and
  never told;
- **a verdict outside its lists** (a `follows` or `carried` that is not one
  of the allowed words) — recorded as invalid, and the requirement unjudged;
- **a verdict under an id it was never given** — recorded as invalid, and the
  real requirement unjudged;
- **a `yes` naming nothing it was shown** — quietly turned into `unsure`, so
  a malformed answer read exactly like a legitimate "I can't tell". The owner
  asked for those two to stay apart.

And one different end: **an answer that was not a list at all** failed the
addition with *"The builder is busy — try again in a moment."*, which asks
the customer to send what they had already said clearly.

Before a hand-off the same omission was worse: a requirement with no verdict
was not handed on, so the next designer never heard of it.

## 2. The rule now

- **Every requirement the judgment is shown needs a verdict anybody can use,
  at both stages.** Before a hand-off the judgment answers meaning only, so a
  `follows` from the four allowed words is a whole verdict. At the end it
  also needs a `carried` from the three, and a `yes` must name at least one
  thing it was shown.
- **The code says which are missing and why.** `readVerdicts` returns
  `missing`: every requirement without a usable verdict, with `no-verdict`
  (absent, or answered under a wrong id), `no-follows`, `no-carried` or
  `yes-without-items`.
- **"unsure" is a whole verdict.** It is never asked again and never
  confused with a missing one; a malformed answer is never read as one.
- **One more call, inside the existing bound.** The bound is the reply
  writer's (`writeReply`): at most two calls, the second naming what the
  first left out. So an answer that leaves anything missing is asked once
  more, every missing requirement named by its id with why. Both answers are
  kept, the second's verdict where it gave one.
- **Still missing after that, the addition stops** on the existing failure
  path (`aDown`, the one a designer's failed call takes): status 503, error
  `send`, cost 0, before anything is applied, charged or published. A
  truncated answer is unfinished in the same way and takes the same path; it
  is not asked again, because the same budget would cut it the same way (the
  reply writer does not re-ask an unreadable answer either). So is a
  requirement with no id, before any call: nothing can name it to the model.
  The route stamps every id (`cleanRequirements`), so that would be a wiring
  fault, and skipping it would have been the same silent omission.
- **What the customer reads** when it stops: *"I couldn't finish checking
  that addition against what you asked, so I stopped before changing
  anything — this is on us, and nothing was charged."* No question, nothing
  for them to repeat. A model call that fails outright (an outage) keeps the
  existing sentence, *"The builder is busy — try again in a moment."*
- **A question, on either call, is still a question**: the model judged that
  a choice only they can make is open, which is not an unfinished answer.
- **Unchanged**: optional and unrelated ideas leave the list as before; the
  checks that what a verdict names was shown and really ran, with the part
  of a table that does the work, are the previous round's, untouched.

## 3. What changed

- `builder/site-requirements.mjs`:
  - `readVerdicts` returns `missing`, with why. It takes `meaningOnly` for a
    judgment before a hand-off. A `yes` naming nothing listed is missing
    (`yes-without-items`), never `unsure`.
  - `requirementRecord` keeps `verdictsMissing`: what each judgment was asked
    for again, why, and whether the second answer gave it (`finished`).
- `builder/site-add.mjs`:
  - `judgeRequest` takes `missed` and appends *"YOUR LAST ANSWER LEFT THESE
    WITHOUT A VERDICT ANYBODY CAN USE: table#1 (no verdict), … Answer every
    requirement listed this time, once each, by its id."*
  - `runJudge` asks once more, merges, and answers `failed` with
    `incomplete` when anything is still missing, the answer was cut off, or
    a requirement has no id.
    It returns `askedAgain` (what the first answer left) and keeps the second
    call's tokens apart (`extraUsage`).
- `worker.js` (the add-on route):
  - the sentence above (`aUnfinished`), taken before a hand-off and at the
    end whenever the judgment was unfinished; `aDown` carries
    `incomplete: true` on the response;
  - one call billed per judgment, the first. The second call's tokens go on
    their own timeline mark (`judge:<step>:again`), because a mark keeps
    eight details (`MAX_DETAIL_KEYS`): the first version put them on the
    judgment's own mark as an eighth and a ninth, and the ninth (the output
    tokens) was dropped without a word. A test caught it;
  - `verdictsMissing` on the stored record.
- `test/fixtures/addon-route.mjs`: the harness records every charge the
  route makes (`charges`), tells a case whether a judgment call is the second
  (`again`), and can answer one cut off (`"cut"`).

## 4. The cost of a judgment call

Estimated, not measured. The requests were built for real
(`judgeRequest`, no model call) at three sizes and priced at the default
model's list rates (`grok-4.6`: $2 per million tokens in, $6 out; 1 credit
is $0.008). Tokens are counted at 4 characters each, and an answer at about
45 tokens per verdict. No prompt-cache discount is applied: the judgment's
rules and tool are marked for caching, so a repeat inside the cache window
costs less. Any reasoning tokens a provider bills as output are not counted,
because nothing here can see them.

| | requirements, listed things | before a hand-off | at the end |
|---|---|---|---|
| the owner's message | 2, 7 | ≈1,330 in, 120 out: ≈0.42 credit | ≈1,480 in, 120 out: ≈0.46 credit |
| a typical add-on | 5, 15 | ≈1,520 in, 280 out: ≈0.59 | ≈1,870 in, 280 out: ≈0.68 |
| a large add-on | 12, 40 | ≈1,950 in, 660 out: ≈0.98 | ≈2,960 in, 660 out: ≈1.23 |

- **What the customer pays**: the first call of each judgment, added to the
  add-on's own calls. The bill is rounded up to a whole credit once
  (`pageCredits`), so the judgment adds its fraction to the total:
  - a typical add-on with one hand-off: about +1 credit (≈0.4–0.7 per call);
  - a large one with one hand-off: about +2–3 (≈2.2 of calls);
  - each further hand-off adds one more judgment.

  This refines the previous round's "+1 typical, up to +3–4" with the
  requests' real size. It is still an estimate.
- **The second call**, made only when a first answer is unfinished, costs
  about as much again as the first: its request is the same plus one line,
  and the model answers in full. It is ours, not the customer's. A recovered
  addition is charged exactly what a whole first answer would have been
  (JUDGE 19 asserts it).
- **When the addition stops**, the customer pays nothing. The calls already
  made (the designers' and the judgments') are ours, as on every failure
  path.
- **The ceiling of one call**: `JUDGE_MAX_TOKENS` is 8,000, at most 6
  credits of output. An answer that reaches it is cut off and stops the
  addition.

## 5. Verification

- **The tests** (`test/addon-judgment.test.mjs`, 23 cases, 6 of them new),
  through the real route on the owner's message:
  - **JUDGE 18, the whole-answer control**: two judgments (before the page
    hand-off and at the end), nothing asked again. The email and the form's
    email field are in the cover note, in the reply model's facts and in the
    page designer's prompt. One charge;
  - **JUDGE 19, empty at both stages, recovered**: four judgment calls and
    the control's outcome. With every call priced large, the charges equal
    the control's: no duplicate charge. The second calls' tokens are on
    their own timeline marks, and `verdictsMissing` names what was asked
    again, finished;
  - **JUDGE 20, empty at the end twice**: 503, `error: "send"`, cost 0,
    `incomplete: true`. No table applied, no page compiled, nothing charged,
    no question; the exact sentence, with nothing in it asking for a repeat.
    Three judgment calls. The record says the email had no verdict, the
    field's meaning was judged at the hand-off, and both were left at the
    end;
  - **JUDGE 21, partial**: the second call names exactly the email, which is
    then recovered and reported with what carries it out. Left out twice, the
    addition stops;
  - **JUDGE 22, invalid**: a `follows` or `carried` outside its list, a `yes`
    naming only what it was never shown, and a wrong id are each asked again,
    naming why, and finished. Invalid twice, the addition stops;
  - **JUDGE 23, a legitimate `unsure`**: not asked again, and told as "I
    can't see from here whether …", never as set up.
- **Older cases**:
  - JUDGE 3, 6 and 12 were re-anchored, because each asserted the defect: a
    skipped entry left unjudged while the addition went on, a `yes` naming
    nothing read as `unsure`, a non-list failing at once with "busy";
  - JUDGE 6 also covers both answers kept, the second's verdict winning, a
    cut-off answer on either call, and an entry with no id;
  - JUDGE 12 covers the stop before a hand-off: the page designer never
    runs;
  - JUDGE 9 asserts a whole answer is one call; JUDGE 13 asserts the two
    sentences (an outage keeps "busy", a cut-off answer is unfinished);
    JUDGE 16 pins the refusal limit (§6).
- **The red check**: the new file and harness against `3ee6ab9d`, the code
  before this fix, in a separate worktree. **7 of 23 fail**, each on the
  omission:
  - JUDGE 12: the addition went on, the email dropped from the cover note;
  - JUDGE 19: the cover note came back empty (the owner's reproduction,
    through the route);
  - JUDGE 20: the addition went on (200), only the field told;
  - JUDGE 21 and 22: the cover note named the field and not the email;
  - JUDGE 3 and 6: the module answered with no `missing` and no second
    call.

  The controls passed on both versions: JUDGE 18 (whole), JUDGE 23 (unsure)
  and JUDGE 9 (one call). The check ran before the cut-off and no-id
  changes; those are shown by the sweep (T1–T4).
- **The sweeps**, over `addon-judgment`, `addon-route` and
  `addon-grounding`, from a green baseline:
  - **this fix's** (`scripts/mutants/incomplete-judgment.json`): the first
    run killed 26 of 26, and the 3 comment-only controls survived. On the
    final code, with four mutants added for the cut-off answer and the
    unnamed entry and one re-anchored: **30 of 30**, and the 3 controls
    survived;
  - **the previous round's** (`scripts/mutants/judgment.json`, with four
    anchors moved onto the lines this fix rewrote): **36 of 37**, and the 3
    controls survived. The survivor, W2, composes the hand-off brief from
    every requirement instead of the judged ones. It is now equivalent: a
    hand-off judgment that leaves anything without a verdict stops the route
    before the brief, and an entry with no id stops the judgment, so no
    unjudged entry reaches that line. On `0f94d159` it was killed by the old
    JUDGE 12 sub-case in which an unjudged requirement went on silently, the
    path this fix removes. The filter stays as a statement of intent.
- **The harness-driven files**: 713 of 713 across all 17, before the last
  additions; they are in the suite below.
- **The suite**: `9525 / 9525 / 0 / 0` here (the 9,519 before and the 6 new
  cases), in 219 s, the real-browser cases included (Chromium is installed
  here; unit CI skips them). The three corrections the owner passed in run
  101's batch and the requirement judgment are among them, unchanged and
  green.
- **CI** on `4865cb97` (this fix's code, `4b6271ff`, with its records on
  top), complete and green:
  - **unit tests** (run 37398006134): `9525 / 9513 / 0 / 12`. The total
    matches the local run; CI skips the same 12 as before (its usual 6 and
    the 6 real-browser cases);
  - **the site build** (run 37398006135): all seven jobs and the gate
    passed. The gate reads *"ALL CHECKS: 404 checks in 27 sections across 4
    shards, every job green"* (shard 1: 108 checks in 1 section; shard 2: 75
    in 2; shard 3: 158 in 16; shard 4: 62 in 8), for commit `4865cb97` and
    site-build inputs `7aa0b0cc1382a4e9` (3,972 files);
  - **the published-site job's step list came back empty from the API**,
    though it ran for two minutes on a runner and concluded `success`. Its
    log shows both checks ran: site-routing *"14 passed, 0 failed"* and
    site-runtime *"47 passed, 0 failed"*. A reporting gap, not a skipped
    job.
- **The image** (predicted, not built): `589e3e4e85a20066` at `d53caefc`
  (deploy 2184's) became `1df286f23782ff82` with run 101's batch and
  `08b996804d8121ea` with the judgment, and becomes `7107b9a349d84ca8` with
  this fix. There are 194 inputs, none under `public/`. Three differ from the
  judgment's (`builder/site-add.mjs`, `builder/site-requirements.mjs`,
  `worker.js`), and five from deploy 2184 (those three,
  `builder/site-addon.mjs` and `builder/site-reply.mjs`). A merge would
  build it, and nothing was built.

## 6. Limits, stated

- **Nothing here is shown live.** The judgment and its second call have run
  only against supplied answers.
- **Completeness is not correctness.** A whole answer that is wrong about
  meaning passes; meaning is the model's (the previous round's limit stands).
- **An addition that stops twice in a row costs the customer nothing, but
  the customer is stuck until the model answers whole.** Nothing tells them
  to send it again, and they may; each stop costs us one or two judgment
  calls.
- **A cut-off answer is not asked again.**
- **Beside a designer's refusal**, nothing is applied and nothing is
  charged, and the refusal is the answer. A judgment there is asked again
  like any other; if it still does not finish, the refusal cannot name the
  other things the customer asked for (JUDGE 16: "One thing your site can't
  do yet: People can pay by bank transfer" is then not said), because
  nothing judged them. Left as the previous round built it; the refusal's
  own wording is outside this gap.
- **Found while writing these tests, and not fixed here** (the owner: *"without
  expanding this audit"*): the cover note names at most two requirements in
  most of its clauses and three in "Still to do", with no count of the rest
  except in "One thing your site can't do yet". The cover note is how
  requirements reach the reply model, so a third requirement told as set up
  and unchecked reaches neither the note nor the reply. The new cases keep to
  two per clause. In `docs/backlog.md`.

## 7. Not done

- **Not merged, not deployed, no image built, nothing pressed or spent.**
- **Not shown live**: a live check would need the owner's word and a paid
  press.
