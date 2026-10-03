# Information limits, batch 1: the words, questions, files and page list whole (2026-10-03)

On the owner's word, for review: **not merged, not deployed, no container
rebuilt, no paid run, no model called.** Build is unchanged (§7). The audit
this batch comes from is `docs/investigations/information-limits-audit.md`,
corrected first (§2).

## 1. The order

> Proceed with the first implementation batch from the information-limits
> audit: complete customer inputs, clarification wording, attachments, and
> authoritative page context across Edit and Add-on. First correct the
> audit's claims: reaching 64 needed answers currently refuses another answer
> while preserving the waiting question; it does not immediately delete the
> request. Keep confirmed code defects, controlled reproductions, untested
> risks, and optional product capabilities distinct, and do not call
> reply-size estimates proof that real model replies fit. For this batch,
> remove the arbitrary 2,000-character request and 500-character
> clarification-answer restrictions throughout the affected browser, server,
> model-input, persistence, queue, and resume paths; do not merely replace
> silent clipping with rejection at those same numbers or raise one constant
> while another hop still cuts the input. Use a consistent technical size
> policy supported by actual request, storage, and model-context constraints,
> and document its rationale. Within that supported budget, preserve the
> complete input; beyond it, preserve the draft and pending state, explain the
> real constraint, and never execute a shortened request. Preserve the meaning
> of model-written questions and answer options: do not cut questions
> mid-sentence, silently discard choices, or submit a shortened option as the
> user's answer. Keep concise-question guidance in the prompt, and handle an
> unusable model response without guessing or losing the waiting request.
> Preserve original and newly supplied attachment references across
> clarification; never silently choose which files to discard, and report any
> genuine attachment limit before execution. Fix the six-page reload issue
> and downstream page-list truncation so route decisions use complete,
> authoritative page identities rather than a partial browser cache; keep
> cached markup separate from page identity, preserve access checks, and
> handle an unavailable or incomplete inventory without treating an existing
> page as absent. Do not add keyword-based routing, site-specific exceptions,
> hardcoded normal customer replies, or a new architecture. Keep Build
> behavior unchanged, including where it shares helpers with Edit and Add-on.
> Add focused regression tests that exercise the real handoffs … Verify what
> each receiving model or executor actually gets, not just what the browser
> stores. Keep tests free and targeted, run the required relevant checks,
> document results and remaining limits, and push the completed batch for
> review without merging, deploying, rebuilding containers, or making paid
> model calls. Leave the pending-request lifecycle, operation/result
> omissions, and reply fallback fixes grouped as the next batches; keep the
> real-model route/operation/target audit explicitly queued afterward.

## 2. The audit, corrected first

Three corrections, made in the audit's own text (its header lists them):

- **64 needed answers does not drop the request.** The 65th answer is
  refused at no cost (`answers-full`, 422) and the waiting question, its
  request and every answer stay exactly as they were, still open for Cancel;
  the request goes only on Cancel or at the 24-hour expiry. IL8's gap is
  that nothing more can be added, so going on means Cancel and retyping.
  The earlier "a full history abandons the request" is replaced.
- **Four classes, kept apart**: a code defect (read in the code), a
  controlled reproduction (the real code driven with supplied model answers
  — not a live run), an untested risk, and an optional product capability
  (new behaviour, not a repair). IL19's capability half becomes **O1** (an
  addition's page writer or a picture step using attached files) and IL20
  becomes **O2** (a Stop for a running edit). The count is now 21 defects
  (7 by controlled reproduction, 14 read in the code), 2 optional
  capabilities, 15 untested risks.
- **The reply sizes are estimates.** P8 measured the facts a reply is written
  from, without a model; it does not show that real replies fit 4,000
  characters or 2,000 tokens. That is **R15**, unmeasured until the
  real-model audit.

## 3. The size policy (`builder/input-budget.mjs`)

Two numbers, read by every hop; the page mirrors them in
`public/edit-poll.js` (held equal by `test/input-budget.test.mjs`):

| Name | Value | What it bounds |
|---|---|---|
| `MAX_INPUT_CHARS` | 16,000 | one message: a request, an answer, a question the builder asks with its answers, one answer offered |
| `MAX_CARRIED_CHARS` | 48,000 | one request with everything that rides with it to each model that resumes it: the request, its put-off parts, every question and answer |
| `REWRITE_MAX_CHARS` | 4,000 | named, not new: the full rewrite's own read of a request (the Build pipeline, unchanged) |

**Why these numbers** — each constraint is read from the code that sets it by
the test, and the arithmetic is checked there:

1. **A queued job's stored answer, 200,000 characters** (`edit_finalize`) —
   the binding one. A job's answer carries its request and every answer for
   its reply (up to 48,000), up to four message-sized copies of words that are
   not new (the unfinished parts and a kept question with its answers: 4 ×
   16,000), the site's pages and the reply (about 6,000), and the rest of the
   answer (the largest of 315 stored: 27,961). About 146,000: a quarter of
   the bound to spare.
2. **The routing route's body, 2,000,000 bytes.** One message is at most 6
   bytes a character in JSON: 96,000 bytes.
3. **The models' windows, 500,000 tokens at the smallest** (`MODEL_LIMITS`).
   The largest edit call (the page writer: page, parts and stylesheet, about
   47,000 tokens, and a 30,000-token answer) plus the carried whole (about
   16,000 tokens) is under a fifth of it.
4. **What a model copies back.** The router quotes a part it holds back
   (`alsoAsked`) and the lane picker quotes each change's words (`scopes`),
   so their output ceilings grow by `echoTokens` (2 characters a token): 8,000
   more at the bound, inside every picker's stated output limit (128,000 at
   the smallest), spent only when used. A cut answer is never acted on: the
   router fails the call on a site that exists (`answer-cut`), the picker
   fails as a call that did not answer.
5. **Money and time** bound nothing here, and the policy says so: a longer
   message is billed for its tokens on every call that carries it (the
   balance is still the only bound), and copying 8,000 tokens back takes
   about 80 seconds, inside the 240-second quick call.

**Beyond them nothing is cut.** The page keeps the words in the box and says
the number before anything is sent; the routes refuse at no cost with the
numbers, a waiting question left as it was; no step is ever handed a shorter
copy.

## 4. What changed, hop by hop

**The words, whole at every hop.** The 2,000 cut is gone from the page
(`siteSend` for a site that exists, `siteAskReply` for every answer), the
router (`askRequest` on a site that exists; `liveBlock` shows the waiting
request, the question and its answers whole), the lane picker, every lane and
the take-off (`site-lanes.mjs`), the text and data steps (`site-apply.mjs`),
the rules, nav and picture steps, the quick page writer (`site-tweak.mjs`),
the rename step (`site-alias.mjs`), the keep check (`page-keep.mjs`), the
add-on picker and designers (`site-add.mjs`, whose `MAX_MESSAGE` is now the
policy's), the stored question (`packAsk`), a held part (`heldList`,
`readAlso`), a resumed request (`MAX_RESUME_DEFERRED_CHARS`), the page's
resumable job record (`rememberJob`: whole, or none) and the page's reader of a
request handed back (`readRouteReply`'s `resume`). The 500 on an answer is gone
(`MAX_ANSWER_CHARS` is one message; `readContext`'s `q` and `a` likewise).

**Refused at the real boundary, nothing lost.**

| Where | Past what | Answer | What is kept |
|---|---|---|---|
| the page, a message | 16,000 | nothing sent; *"That message is N characters, more than one message can hold (16,000 …)"* | the words back in the box |
| the page, an answer | 16,000 | nothing sent; the same, as an answer | the question and its card; the words in the box |
| the routing route | 16,000 (a site that exists) | 422 `message-too-long` / `answer-too-long`, cost 0, `chars`, `max` — before any model, ledger or store read | a waiting question exactly as it was |
| the routing route, an answer | 48,000 carried | 422 `answer-too-long`, `carried: true`, cost 0 | the question exactly as it was; nothing charged |
| the edit route | 16,000; 48,000 carried; 3 files | 422 `input-too-long` / `too-many-files` (`route/…` explanations, with the numbers) | nothing run, nothing charged |
| the add-on route | 16,000; 48,000 carried | 422 `input-too-long`, with the numbers | nothing run, nothing charged |
| the full rewrite (the page) | 4,000, its own read | nothing sent; *"That needs the full rewrite, which reads at most 4,000 characters…"* | the request back in the box |

The page's notices are the page's own sentences for a genuine technical
limit, as the existing `siteHoldUnsent` stops are; the routes' refusals reach
the reply model as facts when replies are model-written
(`routeReplyFacts`: `message-too-long` is new, `answer-too-long` carries the
numbers).

**Questions and their answers keep their meaning** (`readAsk`). A question is
kept whole, every answer offered is kept whole (duplicates aside), and no
answer is shortened; the router and the steps are still told to ask short
questions with a few short answers (the prompt is unchanged). A question that
cannot be shown — longer than one message with its answers, or not text — is
**unusable**, never cut: the router's call fails unbilled and a waiting
question is untouched (the answer comes back to the box); a step that asks
one stops, and the request comes back to the box whole, said as ours
(`ask-unusable`, 503, nothing written or charged). The page draws every
answer, keyed 1–9, and a pressed answer is sent whole as the customer's.

**Files.** An answer's files and the request's go together, the request's
first, and together at most the three one request carries
(`MAX_ATTACHMENTS`): past that, nothing is sent — the answer and its files go
back in the box, the question stays, and the number is said. Picking more
files than fit names the ones left out. The edit route refuses more than
three. **The logo step makes one logo**: given more than one picture it
refuses with the number, before anything is stored, instead of taking the
first (`runLogoEdit`, `several`).

**Page identities from the site itself.**

- The page saves every page's address and name (markup only for the first
  six, as before), so a reload keeps the whole list.
- The page's route read adds the pages a longer list lacks (it used to apply
  only over a list of one), keeping each page it holds with its name and
  markup; it is asked once per page load for every React site, whatever
  the length of the list it holds (it was asked only when one page was
  held).
- **The routing route reads the site's own pages** — only after ownership is
  verified (the same check Lane 1d's table names use), from the stored
  source, through the reader `GET /api/site/routes` uses, bounded at 3
  seconds — and gives the router that list (`pages-filled`). When it cannot,
  the browser's list is used and marked possibly partial: a page missing from
  it stays an edit (`page-unverified`) and the edit step checks it against
  the site's real pages, never converted to an addition.
- The router's digest and the add-on's site note name every page (both cut
  at 24 before).

**What each receiving model or executor gets**, as the tests read it off the
wire (`test/input-handoffs.test.mjs`):

| Receiver | Gets | Cases |
|---|---|---|
| the router | the whole message; a waiting request, its question and every answer, whole | 1, 9, 13, 29 |
| the lane picker | the whole message; on a resume, the request and the answer whole | 1, 28 |
| a lane | the whole message (unscoped) or its own words, and every answer whole | 1, 28 |
| the quick page writer | the whole instruction | 2 |
| the text step | the whole message | 3 |
| the add-on picker and the designer it picks | the whole message | 4 |
| the stored question | the whole request, question, answers offered and answers given | 3, 4, 11, 13–15, 28 |
| a queued resume | the whole request and the whole answer | 5–8, 10, 28 |
| the logo step | every file, the request's first; more than one refused | 19, 20 |
| the router's page list | every page from the site, or the browser's marked unverified | 22–27 |

## 5. Not changed, on purpose

**Build** (§7). The routing rules and prompts (the concise-question guidance
included). Every safeguard in the audit's §7. The 3-file limit (now reported
everywhere it is reached). Table names in the router's digest (24, said as
`tables-cut`; pages were the order). The text step's 400-character
replacement (IL16), the data step's 60 rows and 20 changes and a row value's
2,000 (IL14, R9), the look lanes' cap of four (IL13), MR9's lists (IL11).

## 6. Tests

- **New**: `test/input-budget.test.mjs` (8 cases: the numbers, each
  constraint read from the code that sets it, the page's copy of the numbers,
  every step's model request carrying a message whose last words matter, the
  copy-back ceilings, cut answers, answers past 500) and
  `test/input-handoffs.test.mjs` (36 cases through the real routes, the
  queue and the page — §4's table); one logo case in
  `test/site-logo.test.mjs`.
- **Updated to the new behaviour** (each pinned an old cut or bound): 21
  test files and the harness's list of the page's question functions
  (`test/fixtures/browser-ask.mjs`), all in `2a17e2cb`.
- **Red check**: on the code before this batch (`d805e903`, with only the
  constants module copied in so the files load), 34 of the 36 handoff cases
  failed and the 2 that passed are controls (one file through a question;
  another owner's site is not read); 6 of 8 budget cases failed (the 2 that
  passed state facts true before: the constraints' values and the counting
  helper); the logo case failed (1 of 41). Every failure is the old
  behaviour itself: a cut at 2,000, the 500 refusal, a clipped question,
  a dropped file, six pages, the 24-page cut, the page-unknown conversion,
  no refusal at the boundary, the rewrite starting.
- **Sweep, full suite, image and CI**: §9.

## 7. Build, unchanged

A first build keeps its 2,000 (`siteSend` for a record with no address or
in a first-build round; `askRequest` when no site exists), its question
readers (`readQuestion`, `clipQuestion`, `clipOption`, four answers) and its
answers (`siteAnswer`). The full rewrite is the Build pipeline and reads what
it read (`REWRITE_MAX_CHARS`, 4,000, now named; `buildHeld` uses the name). A
revise reaches it from an edit's climb or the router's `build`: it now gets
the request whole up to that read (it got at most 2,000 before, cut in the
page), and a longer one is held with the reason, never rewritten from a cut
copy.

## 8. Remaining limits, and the next batches

**The next batches, as the audit's plan groups them** (not started):

- **Batch 2 — the pending request** (IL3, IL4, IL6, IL7, IL8, IL17): a side
  question while a request waits; the revise carrying a resumed request's
  answers; more than four put-off parts; expiry and a full history handing
  the request back; the three endings that drop a step's question.
- **Batch 3 — operations and results** (IL10–IL16, IL18, IL19): declined
  kinds, MR9's lists, a step beside a look change in the reply, the steps'
  silent caps, a cut answer said as "busy" (now including the picker's and
  the router's cut answers, which fail as calls rather than being acted on),
  the text step's dropped replacements, an unsettled cost, files on work that
  cannot use them named in the outcome.
- **Batch 4 — the reply** (IL21, IL22): the fallback composer's caps; an
  over-long reply asked again.
- **Then the real-model audit**: real router, picker, step and reply calls on
  the test sites — route, operation, target, clarification, and R1/R2/R15.
  Queued; it needs your approval and a cost estimate.

**Limits that stay, said plainly:**

- **Supplied answers only.** Every case here is a controlled reproduction:
  whether a real model acts on the last line of a 16,000-character message,
  or keeps its questions short, is unmeasured.
- **The copy-back ratio** (2 characters a token) is generous for English and
  may be short for text in scripts that tokenise near a character a token: a
  long held-back part in such a script can hit the router's ceiling, and the
  call then fails as cut — nothing is guessed, but the message has to be
  sent again (recorded as **R16**).
- **Longer messages cost more**: every call that carries them is billed for
  their tokens. Nothing caps money but the balance.
- **The image rolls on the next deploy**: the container's modules import the
  new constants module (`Dockerfile`'s COPY list), so its inputs changed
  (§9). Not built now.

## 9. Measured after the runs

- **Mutation sweep** (from a green baseline: the focused files 85 of 85):
  **42 of 42 mutants killed, both comment-only controls survived**, and
  every file restored with its hash checked. Each mutant put one cut or
  check back — the page's 2,000 (message and answer), its refusal, the
  files check and order, the six-page save and digest, the route-list
  merge, four answers on the card and in `clarifyOf`, the rewrite check,
  the 2,000 resume, the unnamed strip files, `ASK_MAX`; the router's cut,
  its cut-answer check, its 24-page digest, the page-unverified rule, a
  question cut at 240 and four answers, an over-long question read as
  usable, the 500 answer, the router's and the picker's copy-back ceilings;
  the lane picker's, a lane's, the page writer's, the text and data steps',
  the add-on picker's and a designer's 2,000; the cut pick; the add-on note's
  24 pages; the stored question's 2,000; the logo step's first-of-several;
  the routing, carried, edit, files and add-on boundaries; the unusable
  step question; a 20-second page read; the page read skipped.
- **Full unit suite** on `2a17e2cb`: `9070 / 9070 / 0 / 0` locally,
  against `9025 / 9025 / 0 / 0` measured at `d805e903` in a worktree — the
  45 new cases (36 + 8 + 1) exactly.
- **CI on `2a17e2cb`**, both required checks green: unit tests `9070 /
  9066 / 0 / 4` (run 37116075987, read from the job's log; CI skips four)
  and the site build, *"404 checks in 27 sections across 4 shards, every
  job green"* (run 37116076013, its "all checks" job).
- **The image**: main (`b8d12ff9`, deploy 2180) builds `8bfc67dc695e65cc`
  from 191 inputs (161 distinct paths); this branch before the batch
  (`d805e903`) `8c1ec3d5aab3062d` from 192; **`2a17e2cb` `2635a0a1fb74f8c3`
  from 193 (163 distinct)** — the new module is a container input. A merge
  would roll the image; nothing is built now.
- **Screenshots** (real Chromium, the repo's own `public/` at `d805e903`
  and on this branch, every API answer in the Worker's shapes, no model):
  a 2,989-character message (2,000 sent before, all of it after); one of
  16,064 (cut and run before; refused with the number, the words in the
  box, after); a six-answer question (cut at "Which band…" with four
  answers before; whole after); an answer whose files pass three (one of
  the request's dropped silently and the logo set before; held with the
  number after); a 5,014-character request routed to the rewrite (cut to
  2,000 and rewritten before; held with the reason after); an eight-page
  site's page picker after a reload (six before, eight after). The sheets:
  `docs/edits/input-limits-batch1.png` and
  `docs/edits/input-limits-batch1-pages.png`.
