# No question after a charge (2026-10-24, branch `no-ask-after-charge`)

Owner, 2026-10-24: *"the model may ask the customer a question only BEFORE
anything is charged; once work has been charged, it must not stop to ask — it
goes ahead with a sensible stated default and says so in the reply facts."*

Evidence: `docs/plans/2026-10-24-model-wrong-failures.md` §3. Three add-on
`add:pages` questions came after 12–13 credits had been reserved (37 credits on
the jobs). Two nav questions asked for things the site or the message already
implied (a button's destination, the wording of opening hours).

Not merged and not deployed. Nothing was spent: every model answer is supplied.

## 1. Where a model can ask, and whether a charge has landed by then

| Question point | Where | Charged before it asks? | Now |
|---|---|---|---|
| Router (`ask_router` question) | `builder/site-ask.mjs`, routing route | No. The routing call is billed, but it is the router's own call, and the owner counts it as before the work | **Kept** (unchanged) |
| Build design question (`design_schema`) | build route | Every debit is refunded on a question (`refundFields`) | **Kept** (unchanged) |
| Build pages question (`build:pages`, the new build-questions path) | `builder/page-gen.mjs` via `publish-pages.mjs` | Every debit is refunded on a question | **Kept** (unchanged) |
| Add-on picker (`pick_adds`) | `site-add.mjs` ~1574 | No (runs before any reserve) | **Kept** |
| Add-on designers (`add:<kind>`) | `site-add.mjs` ~1886/2587 | No: under a job the first reserve comes after the designs and the seed net (`aCharge` before the schema apply) | **Kept** |
| Add-on requirements judge | `site-add.mjs` ~2963 | No (before the first reserve) | **Kept** |
| Add-on row step | `site-add.mjs`, `row` | It reserves before it writes, and nothing asks after that | n/a |
| **Add-on page writer (`add:pages`)** on an addition with a backend (tables, functions, jobs) | `worker.js` page call, `page-gen.mjs` `SITE_PAGES_TOOL_ASK` | **Yes**: the first reserve (`aFirst`, 12–13 credits in the evidence) lands before the page call | **No question field. It states its default** |
| Add-on page writer on a component or page addition with no backend | same | No: the bill is collected after the page call | **Kept** |
| Edit steps: text and data (`site-apply.mjs`), rules (`site-rules.mjs`), look lanes (`site-lanes.mjs`), tweak (`site-tweak.mjs`), bands (`page-bands.mjs`), frame (`site-frame.mjs`), nav (`site-nav.mjs`), picture (`site-picture.mjs`), the page rung's writer (`page-gen.mjs`) | edit route, through `eQuick` / the page writer's `clarifyCall` | **The first step: no.** Each rung charges after its own reply, and a step that asks is refunded. **A later step of the same request, after an earlier rung's reserve or collect: yes** | First step **kept**. **A later step after a charge: no question field, default stated** |

The edit route's own nav questions in the evidence were first steps, so they
stay pre-charge. For those, the remedy is item 4: the question field now
forbids asking for anything the site or the customer's words already answer or
imply (where a link or button should lead, how something should be worded, how
it should look or be laid out). It names a purpose, not keywords.

## 2. What changed

- **`builder/clarify.mjs`: the gate lives in the one transport every step's
  model call goes through (`clarifyTransport`, `clarifyCall`).**
  - New options: `charged()` (the route's own reading of its ledger),
    `onDefault(list)`, and `replayHas(req)`.
  - Once `charged()` is true, the request goes out with no question field
    (`noAskRequest`). Each tool's `question` is swapped for `defaulted`
    (`DEFAULTED_FIELD`: what was chosen and, optionally, the likely
    alternative). The `required` list no longer names `question`.
  - What the model states it assumed is passed to `onDefault`.
  - **Defence in depth.** A reply that still asks is not returned. The model is
    sent once more with a note (`defaultNote`): it cannot ask, and it should go
    ahead with its own first offered answer. That default is recorded
    (`{ assumed: options[0], instead: options[1] }`) even when the model states
    none.
  - A reply that asks a second time is returned with its question, so the step
    ends in it. The route already charges nothing for such a step: inline the
    answer is `cost: 0`, and a job's answer that is not ok is refunded
    (`edit_refund`). The first call's usage is never billed, the same rule
    `withReuse` follows.
  - **Prepared calls.** A later step's model work prepared before the charge
    (`builder/prepared.mjs`) was recorded with its question field offered. It
    is replayed for that exact request when the record holds it
    (`replayHas` → the new `replayer().has(req)`, the same exact-hash match).
    Without this, every prepared step after a charge was a second paid call
    (GN 5 caught it).
  - **Prompt wording.** `QUESTION_FIELD` now also says never to ask for
    anything the site or their words already answer or imply.
  - `defaultedReport(res, list)` puts `defaulted` on an ok answer only.
- **`worker.js`**:
  - The edit route reads `eChargedYet`: the job's `reserves() > 0`, or the
    inline `syncLedger.taken > 0`. The add-on route reads `aChargedYet`: the
    job's `reserves() > 0`. Inline add-ons collect after the work, so they are
    never charged mid-run.
  - Both routes pass `charged`, `replayHas` and `onDefault` to the step
    transport (`eQuick`, `aQuick`) and to both page writers' `clarifyCall`.
  - Both endings are wrapped in `defaultedReport` (`eDefaulted`, `aDefaulted`).
- **`builder/site-reply.mjs`**: `defaultedFact`. On a finished edit or add-on,
  each assumption is a note the reply must cover: "it used “X”; say that they
  can have “Y” instead by asking".
- **`builder/site-ask.mjs`**: `withNote`, which adds a caller's note after the
  last user message.
- **No new module.** The Dockerfile's worker line is unchanged.

## 3. Tests changed for the new rule (12 cases, 5 files: also SP 3 and model-replies-routes, §5)

`test/live-clarify-continue.test.mjs` (3), `test/live-clarify-continuity.test.mjs`
(3) and `test/live-clarify-limits.test.mjs` (4) drove a step that asked
*beside a change already charged* in the same request. That is the case the
owner now forbids.

- In the continuity cases, the asking stub now asks again when it is told it
  cannot. The step still ends in its question, so the continuity property
  these cases guard (answers kept, completed work never redone or recharged)
  is still exercised through the defence path. Indexes of the resumed calls
  read `.at(-1)`.
- In the limit cases, "offered its question" now reads `[false, false]`: no
  field, and told once.

## 4. Proof

- **Guard tests**: `test/no-ask-after-charge.test.mjs`, 17 cases:
  - the transport, before and after a charge, a question that arrives anyway,
    a second ask, a prepared replay, and a ledger that throws;
  - the reply facts, and `defaultedReport` (ok answers only);
  - the real edit route, inline and as a job: the heading charged, then the
    photo step. It was offered no question, the default was applied, made and
    charged once, `defaulted` is on the answer, no question was kept, and the
    reply facts state it. A step that still asks ends in its question and is
    never charged;
  - pre-charge: a single photo step still asks, at no charge, and the router
    still asks and resumes;
  - the real add-on route as a queued job, through the request-flow platform:
    a table shown on a page. After the first reserve, every page-writer request
    has no question field and has `defaulted`. The addition lands with "Below
    the story", is charged once, and the reply is given the default. A writer
    that still asks leaves the addition waiting, with the edit ledger net 0
    (refunded). A component addition, with no reserve before its page call,
    still offers the question.
- **Red check against `origin/main` (`1b16aaba0`)**: the guard file, with the
  new helpers stubbed so it loads, fails 8 cases (the six transport and fact
  cases, and the edit and add-on default cases). The 8 controls pass on main:
  pre-charge router, step and add-on questions; still-asks-means-uncharged;
  and the prepared replay.
- **Mutation sweep**, from a verified-green baseline (22/22 on the guard file
  and `test/parallel-generality.test.mjs`): 21 of 21 mutants killed. The
  comment-only control survived. The mutants are:
  - in the transport: the gate, a throwing ledger, the strip, `required`, the
    resend, the second ask, the first-option default, the prepared replay, and
    ok-only reporting;
  - the two reply facts and `replayer.has`;
  - in `worker.js`: the job, inline and add-on charge readings, the edit
    `onDefault`, both endings, the add-on writer's gate, and the edit replay;
  - the prompt wording.
- **Full unit suite**: see §5.
- **Image**: see §5.

## 5. Readings

- **Full unit suite** (world-readable worktree, on the code of this commit before the last three test updates): `12641 / 12633 / 5 / 3`. Two of the five are environment-only (`media-verify` browser mode: no Chromium; `no-generated-deps`: the linked `node_modules`). The other three were cases written to the old rule, a step asking after a charge: the limit case (job), now a replayed prepared call; SP 3 in `test/step-pool.test.mjs`; and "A STEP'S QUESTION BESIDE WORK DONE" in `test/model-replies-routes.test.mjs`. Each was updated as in §3, and their three files were re-run: 37 / 37 pass. The whole suite was not run again after those test-only edits.
- **Image**: `origin/main` `1b16aaba0`: site `2d440bd194450245` (235 inputs, 202 distinct), app `65022ce71e3d7274` (9). The head is below in the owner notes. The site image rolls because `builder/clarify.mjs`, `site-ask.mjs`, `site-reply.mjs` and `prepared.mjs` are inputs; the app image does not.
- **Overlaps with the other helpers**: `retry-with-reason` and `provider-retry-2` change the add-on and edit transports' retry, and `auto-split-edits` splits a request into parts. Whoever merges second must keep `charged`/`replayHas`/`onDefault` on `eQuick`, `aQuick` and both page writers' `clarifyCall`. A retry call made after a charge goes through the same gate. A request split into parts that run as separate jobs is **not** covered: each part's job reads only its own reserves, so a later part can still ask after an earlier part's job was charged. That is recorded here as the open edge.
