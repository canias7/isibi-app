# The builder talks while it works: built offline, release prepared (2026-10-13)

**Status: on branch `new`, behind `PROGRESS_TALK` (off by default). Nothing
merged, deployed, built into an image, switched on, pressed or spent.** The
design as built is `docs/investigations/progress-talk-more-proposal.md`.

## 1. What the owner asked

*"Proceed with the progress-message work described in
docs/investigations/progress-talk-more-proposal.md on branch new, with these
corrections …"* — the builder communicating naturally across Build, Edit and
Add-on (initial approach, what it is doing, findings and decisions, questions,
a clear final account), all ordinary wording model-written from facts, fixed
labels and outage fallbacks kept, first-person, no quota, combined events, an
optional folded explanation that is never hidden reasoning, intended / running
/ prepared / applied / published / verified kept apart, reasons only where
recorded, a plan that never delays work, parallel requests explained,
server-side persistence with no duplicates or stale lines, narration failure
never failing work, platform-paid, measured; the branches compared first;
one coherent batch; focused offline tests that separate state from prose;
switches; no merge, deploy, image build, paid image or paid test; one
consolidated live verification prepared.

## 2. Branches compared before any edit

- **`claude/help-needed-ehlwlj`**: 38 commits ahead of `main` (`fef80b9b`),
  last at 2026-10-14 01:55 UTC, a concurrent session. It changes final-reply
  evidence (`builder/site-reply.mjs` fact builders,
  `builder/content-evidence.mjs`, `builder/site-requirements.mjs`), the
  add-on's content-evidence block in `worker.js`, `builder/render-check.mjs`,
  `builder/site-render.mjs`, and the canary scripts; it prepares an
  image-free Build-parallelism audit that reads Build's progress lines
  (`buildProgressVerdict`) and does not change them. **It does not touch the
  progress writer, its record or its UI.**
- **`claude/build-progress`** and the other old `claude/*` branches: last
  commits 2026-08-27 to 2026-09-24, on history `main` has long left; nothing
  to reuse or protect.
- **This batch therefore reuses `main`'s machinery** (record, writer, lease,
  confirmation, sweep, task lines, page list, poll reader, cost log) and
  keeps out of the concurrent session's files, touching `site-reply.mjs`
  only at the reply request.

## 3. What changed (commit `d5925da5`)

| Where | What |
|---|---|
| `builder/site-progress.mjs` | `talkOn`; `TALK_STATES` (+ `checked`, `published`, only on a conversational record — refused on an ordinary one, and an ordinary record holding one reads as nothing); facts may carry a recorded reason (`why`); lines may carry `explain`; records carry `talk`; `startFacts`, `spineCheckFacts`, `publishedFacts`, `talkBuildStepFacts`; `TALK_TOOL`, `TALK_SYSTEM`, `talkRequest`; `readProgress`/`writeProgress` take `talk`; context: first-update hint, what other parts wait for, what this part waited for (`waitedFor`); `PROGRESS_SETTLE_S` = 3 |
| `worker.js` | the recorder carries `talk`; the record opens conversational; the opening plan for Edit, Add-on and Build (not on a resumed build); the checks and the publish in `recompileAndPublish`; a build's container turn; the 3-second ask; the writer's talk call and its explanation committed; the final reply's talk rules and a queued job's `k` facts (`jobChecksFor`) |
| `builder/site-reply.mjs` | `REPLY_TALK_RULES`; `replyRequest`/`writeReply` take `talk` (no fact builder touched) |
| `builder/request.mjs` | a part's lines carry their explanation |
| `builder/edit-job.mjs` | `PROGRESS_TALK` in `JOB_ENV_NAMES` |
| `.github/workflows/deploy.yml` | `PROGRESS_TALK` uploaded, `|| 'off'` |
| `public/edit-poll.js`, `public/chat.js`, `public/styles.css` | the explanation read, kept on a finished reply, and drawn folded under the lines ("More detail") |

## 4. Tests (offline, supplied model answers only)

**Deterministic state, the module** (`test/progress-talk.test.mjs`, 14):
SWITCH, STATES, PLAN, CHECKS, BUILD, CALL (no provider-reasoning field in the
request), INSTRUCTIONS (every state defined, the evidence rules, no example,
no word count), READ (adversarial: a check said as published, a plan said as
done, an id in the explanation, a fact left out, an explanation that is no
string), **LIMIT** (pinned: "it's live" in the words with a true account is
accepted — the prose is not checked), WRITE (misstated then corrected, told
which), LINE, COALESCE, CONTEXT, REACH (the switch reaches the container and
defaults off in the deploy).

**Through the real Worker** (`test/progress-talk-flow.test.mjs`, 10): ADD-ON
TALKS (plan and decision in one call, asked after the wait, one ask for
both), EXPLANATION (poll, request view, finished answer), CHECKS AND
PUBLISH (order, nothing published early, the final reply handed exactly the
record's checks as `k` facts and told it follows a conversation), OFF IS AS
BEFORE, NARRATION FAILING CHANGES NOTHING (job, money, reply), EDIT TALKS,
PARALLEL (each job's lines on its own part, each writer told the other part,
the request writes no line of its own), INSTRUCTIONS ARE NOT CROSSED,
CLARIFICATION (a job that stops to ask closes its record; nothing said
after), LATE AND TWICE (a task after the end calls no model; two deliveries
make one call).

**The page** (`test/progress-talk-page.test.mjs`, 3): POLL, DRAWN, KEPT.

**Build** (`test/build-parallel.test.mjs`, BLD TALK): the record opens
conversational with the plan once; the resumed run adds no second plan; the
container's turn is "built"; no build step says published.

**What these do not show**: anything a real model writes. The `says` check
reads the model's own account of the states it described, never its words;
no number of supplied answers shows that a real model never writes an
unsupported sentence or leaks a detail. That is what the live verification
reads, and even it is a sample.

**Results** — stamped after the runs:
- the new and touched test files: see §6;
- mutation check, full suite, CI: see §6.

## 5. The release, proposed (one, for the owner's decision)

**What would ship:** branch `new` = `main` (`fef80b9b`, the code deploy 2203
runs) plus three customer-visible changes and their tests:
1. no emoji or checkmarks in replies; dashes on the request card
   (`9e9819b5`);
2. one task's updates stack instead of replacing each other (`adacb5b0`);
3. this batch, **switched off** until `PROGRESS_TALK` is set (`d5925da5`).

The ChatGPT-style black-and-white design is a prototype only, not on the
branch.

**Merging with the concurrent branch.** `claude/help-needed-ehlwlj` is 38
commits ahead of `main` and touches files this branch also touches:
`builder/site-reply.mjs` (theirs: fact builders; ours: one instruction line
from the emoji batch, the reply request), `worker.js` (different regions),
`scripts/canary-ui.mjs` and `scripts/canary-additions.mjs` (ours: the ✅/⚠️
reads removed by the emoji batch; theirs: 292 and 78 lines). **Those canary
files will conflict.** Recommended order: merge theirs to `main` first (its
own release), then bring `main` into `new`, resolve the canary reads to
the no-emoji rule (a reply's success is read from the stored answer, a
failure from its sentence), re-run the full suite, and release `new`.

**The image rebuilds** (`worker.js` and `builder/*.mjs` are container
inputs); predict it on the exact candidate before the push.

**Steps, each the owner's:** merge order decided → `main` into `new`,
conflicts resolved, suite green → image predicted → rollback rehearsed in a
throwaway worktree → fast-forward `main` → deploy (one run) → 15–20 minutes
→ the free runtime press (sha, image) → set `PROGRESS_TALK` = `on` and
redeploy (no code change, image reused) → the live verification below.

## 6. The one consolidated live verification (prepared, not pressed)

**One press session, three paths, one new site, image purchases off for its
duration** (the owner's standing rule: no paid image generation without the
owner's word; the switch is the existing `IMAGE_PURCHASES`).

1. **Build** — a first build of a one-page site on a fresh slug, verified
   free first, with a brief that asks for no photographs. Read: the record is
   conversational; its first line is a plan; a `build-container` milestone
   says "built"; the build's final reply. Lines kept after a reload.
2. **One message, three parts, on that site** — (a) an Edit: change a
   heading's wording; (b) an Add-on: a simple FAQ page with no photograph;
   (c) a menu link to the new page, which needs (b). Read: each part's lines
   on its own part only; (c) waits for (b) and its writer is told why; each
   job's record holds `start`, its checks and `published`, in order; each
   final reply names only checks its record holds; explanations, if any,
   folded; how many milestones each writer call covered (the coalescing).
3. **Reconnect** — close the tab while (b) runs and reopen in a fresh
   session: the same lines, the same explanation; no line committed after
   any job's end; the order of lines and final replies.

**Evidence kept:** each job's `jobs/<id>.progress.json` (free reads), the
request record, screenshots at intervals, the final replies, the ledger rows
(narration is never charged: no ledger row for it), and
`scripts/narration-usage.mjs`'s priced read of every narration call
(attempts, tokens, ms, platform cost).

**Realistic customer cost:** **about 17–65 credits** —
- the build 11–45 (first builds measured 11–45; the concurrent session's
  image-free Build estimate is the same range);
- routing about 2;
- the wording edit about 1–3;
- the page add-on 2–13 (runs 47–52);
- the menu link about 2 (runs 49, 63).

Narration is platform-paid and not in that range; it is measured, not
estimated. Nothing caps a request: only the balance bounds it.

**The acceptance it would give:** live evidence of the plan, the checks,
the publish, the combining, the parallel attachment, persistence across a
reconnect, and the final message's checks — on one real model's prose, as
one sample, read by the owner. It would not show the prose is always
truthful.

## 7. Limits

Listed in the design's own "Limits, kept in view": prose unverified; few
recorded reasons; no live fetch behind "published"; Build's and a request's
combined replies not handed `k` facts; the old code-composed `renderNote`
("I had a look at the finished pages") left for the concurrent session's
file; a cut-short browser check does not list the routes it missed; the
3-second wait unmeasured; supplied-model evidence only.
