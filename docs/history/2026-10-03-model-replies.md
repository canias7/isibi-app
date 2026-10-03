# Model-written replies for edit and add-on (2026-10-03)

On the owner's word, for review: **not merged, not deployed, no paid run.**
Deploy 2180 (`b8d12ff9`) was already finished when this started and is left
as it was; this change is separate from it.

## 1. The order

> Make normal customer-facing messages throughout edit and add-on
> model-written, including router clarification, success, partial completion,
> pending work, ordinary refusals, repeated-question explanations, and
> cancellation acknowledgments. Audit both Worker responses and
> browser-generated messages so canned paragraphs are not added after the
> model replies. Code must supply structured, verified facts about what
> changed, what failed, what remains pending, and whether input is needed; the
> model should explain those facts naturally using the conversation and site
> context, without inventing outcomes or changing execution decisions. Keep
> fixed messages only for genuine technical failures such as model/provider
> outages, network errors, or unavailable services; an HTTP status alone must
> not turn a normal product outcome into that exception. Reuse existing model
> calls where practical and report any added latency or credit cost. A
> reply-generation failure must never rerun completed work. Preserve
> clarification state, answer retention, and protections against duplicate
> changes and charges; leave first-build behavior unchanged. Test complete and
> partial success, clarification and follow-ups, ordinary refusals,
> cancellation, and technical fallbacks, checking the final browser-visible
> text against actual outcomes. Update docs/owner-notes.md and push for
> review. If the previously requested deployment is underway, let it finish;
> keep this change separate and don't trigger another deployment or paid tests
> yet.

## 2. What changed, in one paragraph

Every edit and add-on ending that is a normal product outcome now carries a
reply written by the customer's own picked quick model, from facts the code
reads off the route's own final answer — never off the request's wording. The
page shows that reply whole, with the question's card under it when one was
kept, and adds nothing of its own. When a reply cannot be had — the switch is
off, the call fails, times out, or does not explain every fact — the answer is
left exactly as it was and the page says what it always said. Technical
failures of ours keep their fixed sentences, decided by what the answer says,
never by its HTTP status. Nothing about what runs, what is published, what is
charged or what is kept for a question changes.

## 3. How it works

- **The facts** (`builder/site-reply.mjs`). One short statement per fact,
  each with an id and a kind: `c` something that changed, `f` something not
  done (with the builder's own reason, when a step wrote one), `p` a part left
  for later or a request still waiting, `q` the question that needs an answer
  (shown under the reply by the page), `n` a note (a render finding, a
  photograph kept, a secret to add), `m` money (what the change cost, what
  reading the message cost), `u` how to undo, `x` that nothing changed. They
  are read from the same fields the page's own composer reads (`editReplyBody`,
  `addonReplyText`, `editOutcomes`, `partialSaid`, `pageOpsSaid`, `alsoTail`,
  `wholeRequestNote`), so the reply can say nothing the page could not have.
- **The call.** One forced tool call, `write_reply` `{ reply, covers }`, on
  `modelsFor(picker).quick` — the model the customer picked. Besides the
  facts it is shown the conversation the request belongs to — their words,
  and the answers they gave to questions about it (up to the last twelve) — and
  the site: its name where the route has it, its slug and its pages.
  Earlier, unrelated messages in the thread are not sent. The system prompt
  says: only the facts; explain every fact and list its id in `covers`; lead
  into a question without asking or repeating it; say plainly that a part left
  for later was not tried; their words, their language; no steps, tools,
  layers, files, codes or models; no fact ids in the text. A reply that leaves
  a fact out is asked for once more, naming what it missed; a second miss, an
  unreadable answer, a reply over 1,600 characters or one carrying a fact id is
  not used. 12 s per call, 20 s for both. It never throws.
- **Which endings get none, on purpose:** an escalate (not an ending — the
  page walks on), a queued job's receipt, a recovered job, an answer with no
  `ok`, a failure of ours, and a step's question with nothing else to say (the
  question is already the model's own words, drawn with its card: no call).
- **Technical, by what the answer says:** `ours: true`, `failed: true`
  (a routing call), `review: true`, `unbilled` other than an empty balance,
  or a reason on a fixed list (`send`, `store`, `backend`, `generate`,
  `provision`, `schema`, `needs-review`, `clarify-unkept`, `stopped`, `time`,
  `budget` and the rest in `TECHNICAL`). A page the site does not have (422),
  a stale answer (409), a customer's cancel stored at 503, an empty balance
  (402) are ordinary outcomes and are explained. The same reason can be both:
  the page-keep check's `withheld` is ordinary at 409 and ours at 503 with
  `ours: true` — `ours` decides.
- **Where the reply is written** (`worker.js`):
  - the edit and add-on routes, synchronously, at the very end — after
    `heldReport` and `askReport`, so after the work, the publish, the money and
    the kept question (`replyEnding` → `withModelReply`);
  - the routing route's four endings — an answer to a question no longer live
    (409), one too long to keep (422), answers full (422), a question busy
    elsewhere — and only for a site that exists (`rReplyAsk` is null for a
    first build);
  - the question route's cancel, from what the cancel did (`cancelled`,
    `why`, `putOff`);
  - a queued job writes none: its ending keeps what a reply needs beside its
    stored answer (`replyFor`: the request, the answers, the picker, what
    reading cost, the slug and the pages), and the poll route writes the reply
    once, when that answer is first handed back — after the consumer's refund,
    from the money the row settled (`servedEditReply` first) — and keeps it at
    `edit-replies/<job>.json` with a create-only write, so every later poll and
    every other tab hands back the same one; `replyFor` is never served;
  - a question asked again: its note is written the same way (`repeatNote`:
    the answers that did not settle it, and whether only their answer or a
    cancel moves it now), kept with the question and drawn above it, at most
    300 characters; `againNote` is the fallback.
- **The page** (`public/chat.js`, `public/edit-poll.js`). `EditPoll.modelReply`
  returns the reply only when `replySource` is `"model"`, a string, trimmed,
  at most 1,600 characters. `editAnswer`, `applyEditResult`, `addonAnswer`,
  `applyAddonResult`, the routing refusals in `siteRoute` and `siteAskCancel`
  use it first and their own composition only without it. A site under review
  keeps the page's sentence and blocks edits whatever the answer carries. Every
  side effect stays (the preview bump, the picker, undo rows, the balance
  refresh, a question's card and files, what goes back to the message box).
  The edit and add-on posts now carry `routedCost` (the routing reply's own
  `cost`, so a refusal's reply can state what reading cost, as
  `wholeRequestNote` does — never billed from), and the cancel carries the
  picker.
- **The switch.** `MODEL_REPLIES` = `on`. In `deploy.yml` it defaults to `on`
  like `EDIT_ASYNC_EVERYONE` (the GitHub secret exists to turn it off), it is
  in the Worker's secrets list, and it is in `JOB_ENV_NAMES` so a queued job
  in the container keeps `replyFor`. Tests' environments do not set it, so
  every existing test runs the old composition unchanged.

## 4. What is model-written now, and what stays fixed

| Message | Before | Now |
|---|---|---|
| An edit's or add-on's success (sync or queued) | the page's composer, its render sentence and tail | the model's reply from the facts; the composer only without one |
| Partial completion | the page's headline + each refused step's sentence | one reply covering each part and the builder's reason |
| Pending work (parts left for later, a request waiting) | the page's tail | facts in the reply |
| A step's question beside work done | the page's headline, then the question and card | the reply leads into the question; the card unchanged |
| A step's question alone | the question (the model's own words) and card | unchanged — no call |
| The router's question | the router model's own words and card | unchanged; its repeat note written from what happened |
| A repeated question's note | `againNote`, fixed | written by the model; `againNote` the fallback |
| Ordinary refusals (edit, add-on) | ⚠️ + the step's sentence + the page's money + tail | one reply covering the reason, whether anything changed, both amounts |
| The routing route's stale / too long / answers full / busy | ⚠️ + the route's sentence | the model's reply |
| Cancelling a waiting question | the page's fixed acknowledgement + tail | written from what the cancel did and what was put off |
| A queued change stopped at the customer's cancel | ⚠️ + the stored sentence + money + tail | written at the poll |
| Failures of ours (provider down, store, network, sign-in, unreadable, lost track, under review) | fixed | fixed, unchanged |
| The first build, and the full rewrite on a live site | — | unchanged |

**Not in scope, said so:** the full rewrite (the revise) shares its code with
the first build and is left as it was, so an empty balance on a live site,
which the router turns into a build, still gets the build path's 402
sentence; the live progress labels ("Thinking", "Waiting — …") are status,
not replies; a job that ended with no stored answer (lost, under review, a
done job whose answer is missing) keeps its fixed sentence.

## 5. Cost and latency (estimates — nothing measured live)

- **One more call per ending** that gets a reply, and a second only when the
  first leaves a fact out. Notes: one call per question asked again. No
  existing call could carry the reply: the routing call comes before the work,
  and each step's call ends before the outcome is known — a reply written there
  would be written before the facts exist. **Reused where practical:** a
  step's question on its own is already the model's own words, so it is shown
  as it is, with no call.
- **Not charged to the customer.** Each call is logged (`reply: <kind>
  written|fell back (<why>) facts N attempts N tokens in/out ms N`), so its
  cost can be measured from the Worker's log; the ledger never shows it.
  Whether to charge it is the owner's decision (§8).
- **What one call would cost at list price** (`pageCost`, the repo's own
  rates; a typical request is about 3,100 characters, ≈ 860 tokens in):

  | Model (picker) | ~900 in / 120 out | ~1,400 in / 250 out | ~2,800 in / 500 out |
  |---|---|---|---|
  | grok-4.6 (the default) | $0.0025 = 0.32 credit | $0.0043 = 0.54 | $0.0086 = 1.07 |
  | claude-sonnet-5 | $0.0045 = 0.56 | $0.0080 = 0.99 | $0.0159 = 1.99 |
  | claude-opus-5 | $0.0075 = 0.94 | $0.0133 = 1.66 | $0.0265 = 3.31 |

  A retry doubles a reply's cost. At the default picker a reply is about a
  third to half a credit.
- **Latency:** one quick-model call added to the end of every synchronous
  ending and to the first poll of a finished queued job, and to the routing
  route when a question is asked again (the note). Estimated 1–5 s, not
  measured; bounded at 12 s per call and 20 s in all, after which the answer
  goes out without a reply.

## 6. What protects the work and the money

- **A reply can never rerun anything.** It is written only after the route
  has finished — nothing it does writes a page, a row, a question, a ledger
  row or a publish — and a failure returns the answer untouched. A queued
  job's reply is written by the poll, which reads the stored answer; it never
  claims, replays or settles the job. Tested: a failing reply model, a reply
  leaving a fact out twice, a plain-text answer and a reply carrying a fact id
  each leave one change, one publish and one charge, and the page's old
  sentence; a poll whose reply fails hands back the stored answer as it was
  and touches none of the job's bookkeeping, and a later poll can still write
  the reply.
- **One reply per job.** Kept with a create-only write; two polls at once
  both write, the first kept wins, and both hand back that one (tested, with
  the test bucket honouring the wildcard as workerd's `WildcardEtag` reads
  `etagDoesNotMatch: "*"`).
- **Questions, answers and their limits are unchanged.** A note is still at
  most 300 characters and kept with the question; every answer is kept as
  before; nothing about when a model is asked again moved.
- **The first build is untouched** — no reply on its routing answers, even its
  refusals (tested).

## 7. Tests

- `test/model-replies.test.mjs` (16): the switch; technical by what the answer
  says (with `ours` deciding between two outcomes of one reason); each kind of
  ending's facts (complete, partial, question, refusal, add-on, routing stop,
  cancel, repeat note); what is not an ending; the request one call sends; what
  makes an answer usable; one reply in at most two calls, with the deadline,
  a failed call and an unreadable answer; the reply added as two new fields.
- `test/model-replies-routes.test.mjs` (17), through the real routes with the
  switch on and every model supplied — and, where the case is about what the
  customer reads, the real page (`test/fixtures/browser-page.mjs`) sending its
  own requests to the real Worker: complete success on the page; the same
  request with the switch on and off (same fields, change, publish and charge);
  complete success queued (no reply in the job, written once at the poll, kept,
  `replyFor` never served); two polls at once; a reply that cannot be written,
  four ways; a queued job whose reply cannot be written; partial completion on
  the page; a step's question beside work, then the answer resuming only the
  part that asked; a question alone (no call); a question asked again at the
  router (below and at the threshold) and at a step, written and falling back;
  an edit refused on the page; an add-on refused; the three routing stops on
  the page; cancel on the page, and a cancel with nothing to close; a queued
  change stopped at the customer's cancel at its 503, and a stop of ours; the
  failures of ours; the first build and the switch off.
- `test/model-replies-browser.test.mjs` (7): the page's own rules —
  `modelReply`'s bounds; an edit's reply whole, with and without a question; a
  question with parts left for later (edit and add-on); a refusal whole, with
  what was left to do back in the box; a site under review and an escalate;
  an add-on's reply three ways; a replacement that lost a race.
- **Moved, unchanged:** the page harness, from `live-clarify-browser.test.mjs`
  to `test/fixtures/browser-page.mjs`, so the reply tests drive the same page.
- **Re-anchored:** three source guards that pinned `doneText`'s exact spelling
  (`site-ask`, `site-render`); the cancel post now carries the picker
  (`live-clarify-browser`), and the add-on post what reading cost
  (`site-route-failure`).
- **Red check** (a throwaway worktree at `26f58f8a`, main's code): with the
  new tests alone, the module and route files cannot import (1 of 9 pass);
  with the new module beside the old routes and page, 19 of 40 pass — the 16
  module tests and the three controls that assert what must not change (a
  site under review and an escalate; a question alone; failures of ours) —
  and 21 fail.
- **Mutation sweep:** 51 mutants over the module, the Worker, the page, the
  poll reader, the job's environment and the router's repeat, all killed in
  one run; 3 comment-only controls survived; every file restored byte for
  byte. (A first run left one survivor — `ours` ignored — because every test
  of it also carried a reason on the list; the `withheld` pair killed it.)
- **Full suite:** `9012 / 9012 / 0 / 0` locally on `906bacbe` (from
  `8972` at `b8d12ff9`: the 40 new cases; the moved harness and the four
  re-anchored tests add none). Unit CI `9012 / 9008 / 0 / 4` on `906bacbe`
  (run 37096375736; CI skips four) and the site build green, 404 checks in
  27 sections, every job green (run 37096375748).
- **Screenshots** (real Chromium, the repo's own `public/`, every answer in
  `worker.js`'s shapes; the "after" replies supplied): partial completion
  with a part left for later, a step's question beside work done, an
  ordinary refusal, and a cancel — before (the page composes) and after (the
  reply whole). The reply's line break before a question shows as a space
  (N39, the owner's, unchanged).

## 8. What this leaves (MR1–MR8; deliberate unless marked)

- **MR1, untested model behaviour.** No real model has written a reply:
  whether its replies are faithful, how long they take and what they cost
  is unmeasured. Needs a paid run.
- **MR2, a decision.** Reply calls are absorbed, not charged: about a third
  to half a credit per reply at the default picker (§5).
- **MR3, latency.** One quick call more at the end of every synchronous
  ending, at the first poll of a finished queued job, and for a repeated
  question's note — unmeasured, bounded at 12 s per call and 20 s in all
  (the worst case, a provider that hangs). A refusal that used to come back
  at once — a stale answer, one too long — now waits for its reply. On the
  synchronous path the wait adds to the customer's open connection (reset
  at about 273 s in run 21); a queued edit, the default, writes it at the
  poll instead.
- **MR4, scope.** The full rewrite (the revise) and the first build keep
  their composed sentences (shared code), so an empty balance on a live
  site, routed to a build, gets the build path's 402 sentence.
- **MR5, scope, not traced end to end.** A queued job that ends with no
  stored answer keeps its fixed sentence (lost, under review, a finished job
  whose answer is missing). Which sentence a Stop pressed before the job is
  claimed ends on was not traced: `edit_claim` refuses a job whose cancel was
  requested and the consumer only logs it, so the row's later state is the
  sweep's.
- **MR6, a dependency.** Keeping one reply per job relies on R2 honouring
  `etagDoesNotMatch: "*"` as create-only (workerd reads it as its
  `WildcardEtag`); shown only with the test bucket. If R2 ignored it, two
  polls at the same moment could hand back two different replies — never a
  second change or charge.
- **MR7, cost.** The reply's rules and tool (2,211 characters, about 580
  tokens) are sent uncached on every call; prompt caching could cut that
  later.
- **MR8, what a fact can carry.** A fact says only what the route's answer
  carries: "Changed the description." does not carry the new words, because
  the answer does not (D1's kin: `applied` names the table, the row and the
  column). A reply may restate the customer's own words for what they asked
  beside a fact that says it changed — the request's words, not a read-back.
- **An observation, not a closure:** a look ending's facts include each page
  operation that published (`pageOps`), so with replies on the reply covers a
  page change made beside the look — review #9's case, kept separate by the
  owner — shown with supplied answers only.

## 9. Decisions that are the owner's

1. **Charge for the reply or absorb it.** Absorbed today (about a third to
   half a credit per reply at the default picker, up to ~1.7 on Opus).
2. **The switch's default.** On when merged (the secret turns it off).
3. **A live look.** Nothing here is shown with a real model: whether a real
   model's replies are faithful, how long they take and what they cost is a
   paid measurement — proposed for the next check, not run.

## 10. Files

`builder/site-reply.mjs` (new), `worker.js`, `public/chat.js`,
`public/edit-poll.js`, `builder/site-ask.mjs` (`routeMessage` returns the
answers a repeat is made of), `builder/edit-job.mjs`, `Dockerfile` (the
module copied into the image), `.github/workflows/deploy.yml`, the three new
test files, `test/fixtures/browser-page.mjs` (moved), `test/fixtures/live-ask.mjs`
(the bucket's `etagDoesNotMatch`), and the four re-anchored tests.
