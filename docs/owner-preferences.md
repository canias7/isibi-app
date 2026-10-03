# How the owner likes things done

> **Read this at the start of every session.** It holds the owner's durable
> preferences, and the approval boundaries that go with them.
>
> The first section is the "How you like things done" section of
> `docs/owner-notes.md`, moved here word for word on 2026-09-28 (the notes as
> they stood: `git show 28bdc97f:docs/owner-notes.md`). The sections after it
> collect the approval boundaries and the preferences the owner has stated
> since, each with the owner's words and the date. **Add a preference here
> whenever the owner states one**, with their words and the date. The running
> log stays in `docs/owner-notes.md`, which is read on demand.
>
> "You" below is the owner: these notes are written to them.

## How you like things done

**Communication**
- **Plain English, not jargon.** Walk things layer by layer when touring the code.
- **Show UI changes as screenshots** — you review visually. Render it and send it.
- **Say plainly what is proven and what is not.** Every claim gets "proven live"
  or "NOT proven live". Corrections get written down, not quietly fixed.
- **One thing at a time.** You prefer reviewing and fixing bugs one by one over
  big batches.

**Changes**
- **Small and surgical** — do not restyle or refactor beyond what was asked.
- **"If we are not using it, I don't want it on the code."** Dead code goes.
- When you narrow a job mid-change, the scope is exactly what you named.
- **Desktop-first, no mobile** — *"I'm not preparing my app to be mobile friendly
  honestly."* Do not build or pitch mobile layout work unless you re-open it.
- Bulk or destructive operations **dry-run by default**.

**Money**
- **Never spend credits without asking.** Not on a test build, not on a retry.
- **Never auto-retry a failed build** — *"we should not spend your credits for
  you."* You can always ask again.
- Paid builds are **opt-in by a commit-message marker**, so no push can buy one
  by accident.
- **Documentation-only changes must not deploy** and must not buy a test build.
- **Do not raise the free-credit grant to paper over a shortfall** — *"Use my
  account, don't raise the credit thing."*
- Batch fixes into one live run. Six runs in a night drains the account faster
  than a day of real customers.
- Diagnose from the code before spending a run — *"you said to work it out
  first."*
- You delete leftover test sites yourself.

**How the model should be instructed**
- **"I just want the model to write its own css cmon, lets make it no name."**
  No menus, no enums, no named options where the model can author instead.
- **Delete worked examples; state only the purpose.** A worked example is the one
  thing a model reliably copies — two features shipped verbatim copies of ours.
- **"When in doubt, say less to the model."** Three drafts of the attachment note
  each got shorter and each got better.
- **"Don't invent something the customer hasn't asked for — invent something that
  is related to what the customer wants."** An invented detail stays inside the
  brief.
- **A cap the model is only told about is not a cap.** Enforce it in code.
- **An edit is measured against what was asked.** *"If the user wants one thing,
  you change one thing. If the user wants three, you change three… do not change
  something that the user hasn't told you to change."* And each change reaches
  only as far as the ask did — restyling one button is a rule for that button,
  not a new site-wide colour that happens to repaint it.
- **Editing the look is FREE CSS, not a theme picker.** *"Instead of it being a
  specific theme, it's free css — the model can edit anything on the page."*
  Nothing on the page is out of reach of a rule. The freedom and the ceiling are
  one instruction, never separated: anything may change, only what was asked
  does.
- **"They gotta be smart with the questions, not all the time."**
- **"I just want it treated normal, like an attachment — the user will say what he
  wants that for, it's part of the conversation."**

**Product direction**
- **"For edit it should be able to edit literally everything"** it can build — and
  **an edit changes exactly what was asked for and nothing else.** Absent means
  unchanged, never restated.
- **Cost follows the change, not the pipeline.** When asked whether two things
  should be one: do they differ in what somebody DECIDES, or only in how it is
  carried out? Only the first justifies two paths.
- **"The whole site can't not go live if one step breaks — if one step breaks it's
  gotta ship like that, however it is."**
- **"If I close the app the build is still running."**
- **Frontend first**: a first build designs and writes a site; the backend comes
  when editing or when an addon asks for it.
- **"It's gotta be more universal stuff"** — prefer a universal law over a one-off
  patch.
- **Everything is chatbox-driven.** Studio and the video editor were dropped:
  *"pure AI, drop it all."*
- **Rejected a picker** in favour of just attaching the file and saying what it
  is: *"Hey, this is my logo, put it there."*
- **Existing published sites are left alone** — never sweep-rebuild them. A
  rebuild costs credits and re-rolls the customer's page copy.
- **No arbitrary HTML in the head.** Every website builder offers "paste anything
  into your head" and every one of them is a way to get a site hacked.
- **Customer replies should eventually be written by a model from what the edit
  really did** (2026-09-24) — *"customer replies should eventually be
  model-written from authoritative operation results. Do not implement that
  redesign now."* Recorded, not started. Until then the replies are composed by
  code from those same results, never from how the request was worded.
  **Ordered on 2026-10-03** (the last preference in this file, *"Normal
  customer-facing messages are written by a model from verified facts"*).

**The media product (gofarther.dev)**
- **Never name the provider to a user.** "fal" is an implementation detail; error
  bodies and UI copy say what went wrong, never who we bought it from.
- **The chatbox settings are authoritative** — *"the orchestrator has no power to
  change anything that's set on the chatbox."* A generation runs with exactly what
  the toggles show. The director's words never silently change a setting or a
  price. Sound was the one exception and was removed on all three layers.
- **"Make sure you show users the exact error."** The provider's own detail is
  quoted verbatim — *(exact error: "duration: must be one of 4s, 6s, 8s")* — not
  bucketed into a canned line. Quota and balance messages stay clean, because
  there is no useful upstream detail there.
- **A platform failure is never blamed on the user**, and a failed render always
  refunds.
- **Caps are not printed in the UI** — the app rejects loudly with the reason
  instead. A number in a tooltip goes stale; a refusal cannot.
- **Verify a model's limits against the provider's machine schema, never its docs
  page.** The docs have been wrong; the schema is what the API enforces.
- **Only chat-generated media belongs in the Gallery.**
- **Users think in verbs** — "Edit image", not "Image to image".
- **Grids scale by adding columns, never by growing cards.**
- **Skip the Media Agent** in click-throughs and sweeps unless it is the subject.

**Working discipline**
- **Work on the designated branch**, not main directly. `git push origin
  HEAD:<branch>` is the only form that cannot push the wrong commit, and `git log
  --oneline -1 origin/<branch>` is the only proof — the push output is not.
- **A green merge is not a green deploy.** Confirm the deploy run succeeded before
  testing anything live.
- **Never write GitHub's own skip-CI marker anywhere** — not in a commit message,
  not in a PR body, not while explaining it. It silently suppresses every
  workflow: main moves, nothing deploys, and there is no red run to notice. Done
  twice, both times inside prose about the rule itself. Say "the skip-CI marker".
- **Never commit while a mutation sweep is running** — an interrupted sweep leaves
  a live mutant in the tree.
- **Do NOT edit these notes with `perl -0pi` and a unicode `\x{…}` literal** — it
  re-encodes the file as latin1 and mojibakes every dash and emoji. Use the Edit
  tool for prose.
- **Render and look before shipping** — *"keep me updated with render stuff."*
  Several bugs were found only by opening a PNG, never by a passing test.
- **Do not change the highest-leverage prompt in the middle of a run you are
  trying to read.**

## Two notes on the section above (2026-09-28)

- **Paid workflows have been dispatch-only since 2026-09-09.** The line above
  about opting in by a commit-message marker is older: no push starts a paid
  run now, and the marker is still never written in prose.
- **The media product was deleted on 2026-09-12.** Its preferences above are
  kept as you wrote them.

## Approval boundaries

- **Spending.** Nothing paid (a run, a model call, a fal purchase) without your
  approval, and the proposed request and a cost estimate come first. On
  2026-09-28: *"Return the proposed request and cost estimate before
  spending."* An estimate is not a cap.
- **Presses.** You press the workflow runs. A session's dispatch answers 403,
  so when you ask for a free check the session tries once and then hands you
  the inputs, naming each box by its description. On 2026-09-26: *"If dispatch
  still returns 403, stop retrying."*
- **Through GitHub Actions**, not the browser console. On 2026-09-21 you asked
  for the testing to go through GitHub Actions, with no F12 and no JSON
  collected by hand.
- **Merging and deploying** happen when you say so, and there is no pull
  request unless you ask for one.
- **Database changes are approved on their own.** On 2026-09-26: *"Separate
  the photo/attachment/second-message checks from database writes and
  permission changes."* On 2026-09-27: *"Do not implement a whole-database
  restore or run it against an active site yet."*
- **Secrets.** A session reads non-secret columns only, records a secret's
  name and never its value or hint, never mints or reads an owner credential,
  and never describes how the account was topped up.
- **The network.** TLS verification stays on, `HTTPS_PROXY` stays set, and
  the proxy's certificate is never added to Chromium.

## What you've asked for since (2026-09-21 → 09-28)

- **Claims only as wide as the evidence.** On 2026-09-23: *"Keep the claim
  precise: a target supplied by the router now survives through publication;
  real-model target selection remains unverified."* And the same day:
  *"keeping the supplied-model-output limitation explicit."*
- **Container reuse read from the real inputs.** On 2026-09-24: *"Determine
  container-image reuse from the actual inputs; don't assume a roll or require
  an arbitrary wait."*
- **A deploy and its runtime check are two claims.** On 2026-09-26: *"Keep
  deployment success separate from runtime confirmation."*
- **Missing coverage is not a defect.** On 2026-09-26: *"Credit existing tests
  and live runs; do not rerun completed coverage. Separate missing evidence,
  reproduced product defects and deliberately deferred work … Do not equate
  missing live coverage with a product defect."*
- **A found issue stays out of the current milestone.** On 2026-09-27:
  *"don't expand this milestone to fix it."* It goes in the backlog as its own
  item.
- **A test passes on what really happened.** On 2026-09-28: *"receiving two
  replies is not page-removal success."* And the same day: *"For acceptance,
  judge the actual stored and published changes, not only the chosen lane
  names."*
- **No keyword or fixture-specific rules** (2026-09-28).
- **The existing workflow first.** On 2026-09-28: *"Keep the existing workflow
  and avoid new harness work unless a concrete measurement is missing."*
- **Closed stays closed.** On 2026-09-28: *"Keep removal and restoration
  closed. Do not spend another run solely to repeat them."* The closed list is
  in CLAUDE.md's *Where things stand*, so no session repeats finished work.
- **No campaign unless you ask.** On 2026-09-28: *"Keep the other outstanding
  cases and deferred issues listed separately; no new sweep campaign or
  architecture redesign."*
- **Form values you can copy.** On 2026-09-28, asked for a workflow press's
  values: *"Each separated so i can copy"*. Give each box's value in its own
  code block, under the box's description, with the link and the branch in
  blocks of their own.

## What you've asked for since (2026-09-29)

- **A change to code is found by its structure, never by the characters
  around it.** *"Use reliable TSX structure to identify the exact photo
  element. Do not infer safe deletion solely from neighboring characters."*
- **Take only what is demonstrably part of the thing removed.** *"Do not
  automatically delete every parent that becomes empty. Preserve wrappers with
  layout, anchor, interaction, or other independent meaning."*
- **Several changes keep their exact targets.** *"Preserve exact target
  identity when applying several changes. Matching again by page and alt text
  is insufficient when two photos share a description."*
- **A contradictory model answer is invalid, not a choice to make.** *"report
  that operation as invalid rather than silently choosing clear.
  Independently valid operations should still proceed."*
- **Say what happened from an explicit result, never an inference.** *"Carry
  an explicit removal result into the reply and recovery hint; do not infer it
  from photosRemoved > photos."*
- **What cannot be done safely is refused accurately and recorded.** *"give
  an accurate refusal without silently clearing the image or removing a
  larger block. Record this as a remaining capability limit."*
- **An exception accepted for one acceptance stays specific to it.** Closing
  Test 7: *"Accept the missing final newline as a specific nonfunctional
  exception for this acceptance. Keep it recorded; do not claim byte-for-byte
  preservation or exempt other whitespace changes generally."*
- **A mixed request is split by operation, never sent whole to one editor.**
  On the menu gap: *"Do not hardcode wording, sites, or pages, and do not
  route the entire mixed request into the menu editor."* Each operation
  reaches its own executor, unrelated links and content are preserved, and
  when one part cannot run the outcome says so accurately.
- **A route is chosen for the whole request.** After Test 8's run 63:
  *"Resolve conflicting instructions so the router considers the whole
  request before choosing a path or deferring any operation."* Single changes
  keep their efficient route, only work that cannot run together is deferred,
  deferred words never run, and no rule forces every mixed request into one
  path.
- **A route is chosen by its targets, never by kind.** Reviewing the first
  whole-message rule: *"Make the universal rule depend on whether a route can
  execute the entire request across all its targets. Preserve a specialized
  route when it can do everything requested. Otherwise, use look when its
  existing scoped execution can complete everything, including same-kind
  changes on different pages. Defer only work that cannot run together."*
  Changes of one kind are not one route's work when that route cannot reach
  every page they are on.
- **A merge takes only what was reviewed.** *"Merge the reviewed branch
  through 907840c67497b2624f1a2febfdb27b947ca5222a into main and deploy,
  after confirming no unreviewed changes have entered the branch."* A merge
  names the reviewed commit, and nothing past it goes in.
- **Controlled evidence is not a real model's choice.** *"Clearly distinguish
  controlled execution evidence from proof that a real model chooses the
  correct route."* Supplied answers prove what the code does with an answer;
  only a live run shows which answer a model gives.
- **Acceptance in small batches that really overlap.** *"Prepare the next
  bounded batch of up to three independent acceptance groups from the
  remaining six. Use existing ready fixtures and workflows. Prioritize checks
  that can genuinely overlap; do not force three if only two are ready."*
  Dependent steps stay in order within a group. Before runs are recommended
  side by side, check that targets and controls cannot interfere, that the
  account and the queue allow it, and that each router request's and job's
  charge can be told apart; an account-wide balance reading cannot.
- **Closing keeps the failed runs.** Closing Test 8: *"Record it as closed and
  retain earlier failed runs as history."*
- **A plan's claims are enforced by the run.** Reviewing Batch 1: *"The plain
  canary does not enforce the routing expectations claimed in Batch 1… Add the
  smallest generic, opt-in expected-route check… Do not override the model's
  answer or add fixture-specific product routing."* What a press is said to
  require, the harness refuses when it does not happen, before anything
  else is spent.
- **Estimates are not limits.** *"Keep estimates separate from enforced
  limits; remove '10 at worst' and 'balance can't run dry' unless supported by
  an actual bound."*
- **Recovery covers every difference.** *"Resetting row 4's price alone cannot
  recover another changed row or field. Capture the complete four-row baseline
  and specify recovery for each unintended difference. A saved page version
  does not restore database rows. No live recovery writes are authorized
  during preparation."*
- **The agreed list stays as agreed.** *"Preserve the agreed remaining
  acceptance list… Keep live guard-rejection evidence separate rather than
  silently substituting it for the follow-up case."*
- **An unexpected change is reviewed, never swept back.** Approving Batch 1:
  *"Unexpected changes require review; do not perform a broad database
  restore."* A difference a test did not intend is reported for your review;
  it is not undone with a restore that also takes back everything else.
- **An acceptance keeps its limits in view, and a missing reading is no reason
  to rerun.** Accepting Batch 1's group A: *"Keep the timing limitation
  explicit: redirects were read 14 and 25 minutes after publication, not
  immediately. No rerun solely for that missing immediate reading."*
- **A misroute is a finding, never a pass, and is not retried with a
  model.** *"Keep B2's text misroute as a separate finding; do not count the
  reversal as passed or retry it with a model."* The row it left behind is
  put back by your own free write.
- **The next work comes from free analysis, in parallel where it can.**
  *"Prepare the next independent work from the remaining checklist using
  free analysis only. Keep parallel execution in the plan wherever
  dependencies allow. Do not repeat accepted tests or expand into another
  testing campaign."*

## What you've asked for since (2026-09-30)

- **The handoff lives in owner-notes, and is pushed before review.** *"Use
  docs/owner-notes.md for the current handoff: completed work, test results,
  commit/run links, observations from our chat, blockers, and the exact next
  action. Record the standing handoff process in docs/owner-preferences.md:
  update, commit, and push the handoff before saying the work is ready for
  ChatGPT to review. Include any recent results currently missing from the
  docs. Do not edit CLAUDE.md."* So before any "ready for review", the
  *Current handoff* at the top of `docs/owner-notes.md` is rewritten with
  those six parts and any result the docs are missing, then committed and
  pushed. CLAUDE.md is not edited for it.
- **A run is credited only for what it exercised.** *"Clarify the records:
  run 78 confirmed the runtime, but did not exercise the fixture guard
  because expect_rows was blank."*
- **One path's result does not stand for another's.** *"Record exactly what
  you exercised—an API save succeeding does not establish what happened
  during my earlier browser attempt."*
- **Read before writing, and never write what is already right.** *"Read
  first. If it is already 40, verify it without writing again. Change only
  the price; preserve every other field and row."*
- **A blocker is reported exactly, not handed back.** *"If access genuinely
  blocks you, report the exact blocker instead of automatically handing the
  task back to me."*
- **No cause is inferred from missing evidence.** *"missing Supabase activity
  does not conclusively prove no request reached the Worker"*, and *"Don't
  infer user error or an application defect."*
- **A guard proves its read is whole.** *"Prove the table read is complete
  using the existing API's supported count/pagination contract. An
  incomplete or unverifiable read must stop before paid routing."*
- **Demo sites are not put back between tests.** *"Stop treating data
  restoration as a prerequisite. These are demo sites; I don't require them
  restored after each test. Use whatever state currently exists as the
  baseline."* And, of `fretwork-1`'s row 4: *"Don't force the price back to
  £40."* So a test starts from the table as it stands, read whole, and its
  disposable row may be an existing demo row. A difference a test did not
  intend is still reported and never swept back; putting data back is simply
  no longer a step before the next test.
- **The deletion acceptance, in your words.** *"The acceptance we're working
  toward is a normal AI request going through the real edit route: correct
  row deleted, unrelated rows unchanged, website reflecting the deletion, and
  billing correct."* And: *"Keep the next paid run subject to my approval and
  a credit estimate. Don't repeat accepted tests."*
- **Closed tests keep their data.** Closing runs 79 and 80: *"Keep the demo
  data as it stands."*
- **The follow-up acceptance, in your words, as it arrived.** *"prepare one
  bounded test of a follow-up after failure in the same chat tab: 1. A
  request produces a genuine, visible edit failure. 2. Without reloading, a
  normal second request succeeds. 3. Verify the second message submits
  correctly, its intended change happens,"* The message stopped there. The
  checks after it are mine, from your deletion and D1 lists, until you
  confirm or correct them: the failure changed nothing and its edit charge
  came back; unrelated rows unchanged; the website reflects the change;
  billing correct; no reload. **Accepted when you closed Test 9**: *"The additional
  data, website, refund, billing, and no-reload checks are accepted. Keep
  the demo data unchanged and don't repeat this test."*
- **A reordering test starts from what controls the order.** *"First trace
  what controls its order: a stored ordering field, a database query, or
  page code. Establish the supported edit path and choose a request that
  visibly changes the order. Don't assume every reordering belongs to the
  data layer or change routing policy merely to make the test pass."* And:
  *"If a product decision is genuinely required, explain that specific
  decision with your recommendation."*
- **Sorting a list: site-wide is the data sorter, one page is the page
  editor.** Deciding 2b: *"Use the existing data-sort lane for site-wide
  sorting by an existing column. Requests limited to one page should use the
  existing page editor while the data sorter remains site-wide. Do not add
  the proposed 'whatever page they saw it' rule. Different pages may
  intentionally use different orders."* And for the test: *"make the intended
  scope explicit"* in the request itself.
- **"Not limited to one page" is not "across the site"; a selection keeps
  its selection.** Correcting the rule (2026-10-01): *"Use data-sort when the
  requested change applies across the site. Keep a one-page request on the
  page editor. A request limited to a selected group of pages must preserve
  that selection; never expand it to every page showing the table."* And:
  *"If no existing route supports a requested selection, report that
  limitation rather than silently widening the change. Do not build another
  capability for this correction."* And for the tests: *"Clearly distinguish
  checking the router's instructions from proving a real model's choice."*
- **A list-sorting request that names no page applies across the site.**
  Passing the correction (2026-10-01): *"Keep the default that an unqualified
  list-sorting request applies site-wide."* And: *"Keep selected-page
  real-model behavior marked unproven; don't expand this into extra paid
  tests."*

- **Adding one item to an existing list goes to the add-on step.** Answering
  2a while asking for Test 11 (2026-10-01): *"Respect my existing rule: 'Add
  will always go in addon.'"* And for preparing it: *"Don't change routing
  policy or start a paid run during preparation."* A capability or testing
  gap found on the way is explained, with the smallest next step proposed,
  not built.
- **A new entry's id is the database's to give, and an expectation never
  predicts it; real model routing stays unproven until a live run.** Asking
  for Test 11's capability to be built (2026-10-01): *"Correct Test 11's
  expectation: the new ID is database-assigned, not necessarily 7. Verify
  the new item appears in both the sorted list and the order form's
  choices. Keep actual model routing marked unproven until a live run
  exercises it."* For the build: *"Keep it universal—no bakery-specific
  rules."*, *"Share the existing parameterized insertion logic instead of
  copying it."*, *"Use a stateful test fixture containing existing rows."*,
  *"Use the existing job and billing machinery."* And its bounds: *"No
  merge, deployment, live data writes or paid calls yet. Leave demo data as
  it stands."*
- **A reading the owner's reviewer verified is recorded as theirs, and the
  manual check offered for it is withdrawn.** After run 84 (2026-10-01):
  *"ChatGPT independently verified Supabase … Record that verification and
  remove the optional manual billing-check instruction."*
- **A write whose outcome is not known is never told as a failure, never
  refunded as one, and never invites a retry; the request's own marker
  settles it, and what it cannot settle goes to the existing review
  machinery.** On the review of `f6532d66` (2026-10-01): *"After an uncertain
  write or unreadable result, reconcile against the existing request marker.
  If it confirms the insertion, return the saved result and settle billing
  correctly. If the outcome remains unknown, report that uncertainty and use
  the existing review machinery; don't claim nothing changed, invite a fresh
  retry, or refund as a confirmed failure."* And: *"Keep same-request replay
  from duplicating rows or charges."*
- **A check a test prints must decide the test.** The same review: *"In the
  addon branch, the after-read verdict must affect the final pass/fail and
  exit status. A row-only success containing no saved rows must fail. Add
  negative tests for both cases. Preserve valid pageless add-ons and existing
  edit behavior."* With its bounds: *"Keep this correction scoped to the new
  row flow and its settlement/testing integration. Keep Test 11 unproven live
  and accepted tests closed."* and *"No merge, deployment, paid calls or live
  data writes. Do not edit CLAUDE.md."*
- **Protection comes before an irreversible write, or there is no write; a
  refund needs a confirmed non-application, and a kept charge needs a
  recorded outcome.** On the review of `31741f6f` (2026-10-01):
  *"Establish durable protection before issuing the row write. If that
  protection cannot be confirmed, do not issue the write. Once a write may
  have happened, the consumer and sweeper must preserve its uncertain state
  until the request marker settles it. Keep refunds tied to confirmed
  non-application, and billing claims tied to recorded outcomes."*
- **A test that asserts the defect is replaced, never kept.** The same review:
  *"The test "a job the review mark refuses…" currently asserts this behavior.
  Replace that expectation; it does not satisfy the previous instruction."*
- **A failure line says what is known.** *"A row-uncertain answer must not be
  described as "a completed round trip that added nothing.""*
- **The handoff is rewritten for every correction round.** *"The current
  handoff has not been updated for this correction round; update
  docs/owner-notes.md with the final changes, results, limitations and next
  action, then commit and push."* With its bounds: *"No merge, deployment,
  paid calls or live data writes. Keep Test 11 unproven live and leave
  CLAUDE.md alone."*
- **A guard before a write establishes eligibility and protection in one
  step; a status read followed by an unconditional mark is not one.** On the
  review of `c3e310e6` (2026-10-01): *"Make the pre-write guard establish
  that the job is both eligible to write and protected. If refund or
  termination wins the race, issue no row write. A status read followed by
  the current unconditional mark is insufficient."*
- **Reuse an existing guarded operation when it enforces the rule; a
  database-function change is prepared for review, never applied live.** The
  same review: *"Reuse existing guarded job operations if they enforce this
  correctly. If a database-function change is necessary, prepare it for
  review without applying it live. Preserve exempt-account behavior."* With
  its bounds: *"No merge, deployment, live SQL changes, paid calls or live
  data writes. Test 11 remains unproven live. Keep accepted tests closed and
  leave CLAUDE.md alone."*
- **A race is covered in both orders.** The same review: *"Add focused
  coverage for this exact interleaving and the opposite ordering, where
  protection wins and an uncertain write must remain held until its marker
  settles it."*
- **CI: fast checks while correcting, the whole integration suite before a
  merge, and nothing skipped to get there** (2026-10-01): *"I don't want a
  20–25-minute wait after every correction."* — *"Run fast unit tests and
  relevant focused checks during correction rounds. Keep the full integration
  suite as the final pre-merge check, with evidence matching the code and test
  inputs being merged."* — *"Don't simply delete worker.js from the trigger
  list, silently skip necessary checks, or report skipped coverage as passed.
  Runtime code inside the image still needs appropriate validation."* So a
  correction is reported once the unit suite and its focused checks pass,
  without waiting for `site build`; a merge waits for `site build`'s `all
  checks` gate on the candidate, or on a commit with the same inputs
  fingerprint (`node scripts/site-build-gate.mjs fingerprint <rev>`). The
  record is `docs/history/2026-10-01-ci-speed.md`.
- **Matching inputs are evidence: the full suite is not repeated for them**
  (2026-10-01, merging the CI change): *"Full run 36841508489 covers the
  current code: both commits have input fingerprint 1d31ea591baf27b1. Don't
  repeat the full suite for unchanged inputs."* So a `site build` run counts
  for every commit with the same inputs fingerprint; read the fingerprint on
  both commits before relying on it. Restated on 2026-10-02 (the batch
  corrections): *"Reuse passing CI wherever its inputs remain unchanged."*
- **One runtime check, for the deployed commit; the 403 dispatch is not
  tried again** (2026-10-01, deploy 2176): *"provide the exact inputs for ONE
  free runtime check using the newly deployed commit. Don't request a
  separate check for the old deployment or repeat the known 403 dispatch
  attempt."* So when a deploy follows one whose runtime was never checked and
  carries the same code, one press naming the newest commit covers both; and
  the boxes are handed over without a dispatch attempt.
- **A new record in an existing list is an addition, everywhere, by rule and
  not by keyword** (2026-10-01, after run 86): *"Adding a NEW record to an
  existing table/list must select addon. The parent list already existing
  does not make the new item an edit."* — *"Make this general across
  products, services, team members, etc. No bakery-specific rule or keyword
  override. Updating or deleting an existing row remains edit/data; preserve
  sorting scope and mixed-request handling."* So the router's wording says it
  for every kind of list, the route never rewrites an answer from the
  message's words, and changing or removing an existing entry stays `data`.
- **A routing test reads the request the model is sent; a supplied answer
  proves only what happens next** (the same day): *"Verify the actual request
  sent to the model; supplied model answers prove downstream handling, not
  real classification. Keep the canary's expected-addon guard."* So a wording
  change is checked on the request as it leaves the route, to each provider,
  and a supplied-answer case is never reported as evidence of how a real
  model classifies.
- **Broad real-model testing, in a few substantial requests, with the
  builder choosing its routes** (2026-10-01, after the router fix):
  *"Prioritize broad, real-model product testing and move faster by grouping
  compatible changes into a few substantial requests."* — *"Let the builder
  choose its routes and execution steps; do not manually force routes or
  split a mixed request behind the scenes to manufacture success."* —
  *"Verify every instruction independently against the actual pages, stored
  data and functioning behaviour, preserve unrelated content, and leave
  intentional demo changes in place."* — *"keeping first-message and
  follow-up outcomes separate"* — *"verify that the builder's reply matches
  what actually happened."* — *"Before paid execution, present the exact
  requests, required attachments and fixtures, concise acceptance checks, and
  a realistic total cost estimate for approval."* — *"Reuse setup and matching
  CI evidence, keep internal testing tied to concrete failures or required
  gates."* So a batch groups what one route can make together, and keeps a
  mixed message as a mixed-request test; no route box gates what the builder
  answers; each part is reported as completed, failed, ignored, deferred or
  unsupported, with the reply checked against what the operations did; and
  new tooling waits for a concrete failure or the owner's word. The first
  plan under it is the checklist's *Broad real-model batches*.
- **A router audit comes before any broader test** (2026-10-01, after deploy
  2177): *"Keep the current routing fix and original Test 11 retry as the
  immediate task. Once that result is verified, our next priority is a router
  audit before resuming any broader tests. Audit the routing instructions,
  supplied context, route selection, fallback behavior, mixed requests, page
  scope, follow-ups and attachments. Explain the actual decision flow and
  identify contradictions or gaps, then propose a focused batch of real-model
  routing tests with a cost estimate. Keep the broad plan and batch-runner work
  paused."* So nothing broader is pressed until the audit is delivered and its
  test batch approved, and the audit itself spends nothing.
- **Every new addition belongs to the add-on path; where it can't perform one,
  that is a missing capability to document** (2026-10-02, reviewing the
  router audit): *"all new additions belong to the add-on path, including new
  menu links, footer links and header buttons. If add-on cannot perform them,
  document the missing capability instead of treating edit as the correct
  answer."* And for the audit's test matrix: *"Separate intended behavior,
  current implementation and observed model behavior in the test matrix. Mark
  predicted downstream consequences as unverified until measured. Keep Test
  11's successful saved-row outcome, but distinguish it from proof of the raw
  model's choice."* So an expected outcome never names an edit for an
  addition; a prediction about a later step is labelled unverified until a
  run measures it; and a route's answer is not proof of the model's own
  choice while a fallback could have produced it.
- **A batch's own runtime checks replace a separate free press** (2026-10-02):
  *"Use the batch's own runtime checks before spending instead of requiring a
  duplicate free press."* So a paid batch press checks the deployed commit and
  image itself, before its first paid call, and stops there at no cost when
  they don't match.
- **A held-back part is checked against the message, never just for being
  there** (2026-10-02, reviewing the routing-only batch): *"C1 and C2 must
  verify that alsoAsked contains the correct complementary request for the
  selected route, grounded in the original message. Nonempty text alone is
  insufficient."* So an expected hold names the part held back and the part
  the route makes, and an answer is judged by what the route would really
  take out and run.
- **A probe that depends on the site's state uses a verified state and
  records it** (2026-10-02): *"Use a page with a verified existing photo and
  record that starting condition so it actually tests replacement."* So a
  probe's precondition is read from evidence (a run's before-read, a fresh
  read), written into the probe with the version it was read at, and read
  again if the site changes before the press.
- **A fix whose cause the code and an existing reading already show is built
  without re-measuring first, and it reuses what already works** (2026-10-02,
  fixing run 90's five additions): *"Don't spend on repeating the unchanged
  requests first: the conflicting instructions are visible in code and run 90
  shows all five misroutes."* — *"ensure the add-on path can actually deliver
  them before changing live routing. Trace and reuse suitable existing
  execution code through shared helpers where practical; avoid duplicating
  whole pipelines or adding keyword overrides."* — *"Preserve existing-item
  edits, removals, row additions, page scope and correct mixed-request
  handling."* So a routing change ships only with the capability that
  serves it; new behaviour reaches existing executors through shared helpers
  rather than copies; nothing keys on a message's wording; and the next
  spend is one post-fix batch that shows routing and the delivered result
  together.
- **Findings outside the round are kept for the next one, not folded in**
  (2026-10-02): *"Keep undo, conversation context and attachment delivery
  recorded as separate findings for the next round."*
- **A verdict passes only on what it really saw** (2026-10-02, reviewing the
  additions round): *"require decision.source=model and
  decision.raw.intent=addon, with no routing failure; a final addon intent
  alone currently lets a fallback from raw edit pass."* — *"Strengthen the
  stored and served text checks: "We're NOT closed on bank holidays"
  currently passes the expected closure statement."* — *"Also preserve the
  untouched frame fields, including the business name, legal links and
  layout; blanking the entire CHROME object currently hides those
  changes."* So a routing check needs the model's own answer (a fallback or a
  failed call never counts, even when it lands on the expected route), a
  words check needs the words stated (whole, and not denied in their
  clause), and a preservation check takes out only the places the change was
  allowed to touch, never a whole object.
- **An addition fills only what each page lacks** (the same review):
  *"preserve existing contact fields per page and test differing contacts
  across pages."* So what one page shows is never read as every page's, and
  an addition never writes over a page's own value; tests use pages that
  differ.
- **A validation batch: the paid press's own preflight, the routing controls
  first, the demo changes kept** (the same review): *"Remove the separate
  free rehearsal and restore from the validation plan: use the paid run's
  built-in preflight, run routing controls before the additions, and leave
  the demo changes in place. Update the cost estimate."* So the additions
  batch is two paid presses, the controls first, each checking the deploy
  before its first paid call; nothing is restored afterwards; and the cost
  estimate is restated whenever the plan changes.
- **After these fixes are verified: a whole-router audit** (the same
  review): *"After these fixes are verified, our next separate task is a
  whole-router audit across build, edit, add-on and internal handoffs for
  hardcoded intent decisions and behavior across different wording and site
  types."* A separate task, not started before the fixes are verified.
- **An audit says who decides, and labels every finding** (2026-10-02,
  starting the whole-router audit): *"Find intent decisions made through
  keywords, regexes, site-specific exceptions or overrides of the model's
  answer; distinguish those from legitimate validation, permissions and
  capability dispatch."* — *"For each finding, document the code location,
  expected versus actual behavior, evidence, impact and proposed fix,
  clearly separating confirmed defects from untested behavior."* — *"Use the
  current site state and existing evidence; don't repeat the completed
  batch."* — *"prepare one grouped real-model validation matrix using varied
  wording and different site types, with a cost estimate before spending.
  Keep this round to the audit and focused free checks; no deployment or
  unnecessary container build."* So an audit round spends nothing and
  changes no site; a finding is *confirmed* only by the code, a free check or
  a past run; its probes start from a state read that day, use wording and
  sites the completed batches didn't, and come with a cost before any press.
- **A fix batch is the findings you name, fixed together; the rest stay
  tracked** (2026-10-02, the audit's batch 1): *"Fix W1–W4 together first
  … Keep the other findings tracked for the following batches."* So a batch
  fixes the findings named and nothing else on the list, and every other
  finding keeps its place in the audit and the backlog. A defect found on
  the way that shares a fix's root is folded in and said so; anything else
  is recorded, not fixed.
- **Three classes, never mixed** (the same order): *"update the audit to
  distinguish confirmed code defects from conditional risks and untested
  model behavior."* So every finding says which it is: a defect the code
  shows for inputs the product meets today, a risk that needs a condition not
  shown today, or an outcome that rests on what a model answers.
- **A removal's regression check proves the removal and the neighbours**
  (the same order): *"Add focused regression checks through the affected
  execution paths, including successful intended removals and unchanged
  neighboring content."* So a fix's tests go through the route that runs it,
  show the intended thing gone, and hold what sits beside it byte for byte.
- **A fix batch is held for review** (the same order): *"commit/push the
  fixes and current owner-notes for review; leave CLAUDE.md alone. Hold paid
  runs and deployment until this batch is reviewed, and avoid an unnecessary
  container build."* So the batch is pushed with the handoff, nothing is
  merged, deployed or spent before your review, and the image a merge would
  roll is predicted, not built.
- **The model names the targets; code only checks them** (2026-10-02,
  reviewing batch 1): *"Let the model identify the targets and have code
  validate them, without customer-word heuristics."* So when a step must know
  which entries the customer meant (a language, a QR code, a control), the
  model answers their names from the list it is shown, and code compares
  those names with the stored list: a name on it acts, a name not on it acts
  on nothing and is said. Nothing in code reads the customer's words to
  decide which.
- **How many there are never says which one was meant** (the same review):
  *"list length does not establish which item the customer meant, so a
  request for an absent language or code must preserve the existing
  item."* So a list of one is asked about like any other, and a request
  naming something the site does not have changes nothing, even when the
  site has exactly one such thing.
- **A review's gaps are fixed together before the merge** (the same
  review): *"Hold the merge and fix these batch-1 gaps together … Add
  focused regressions for these cases and preserved neighbors."* So a batch
  you send back stays unmerged until each gap you name is reproduced, fixed,
  checked against your exact case and the neighbours it must leave alone,
  and pushed for your review again.
- **Reviewed batches wait to deploy together, and one grouped live batch
  validates them** (2026-10-02, passing batch 1's review gaps): *"keep its
  live-model confirmation pending … Keep deployment and paid runs pending so
  we can combine the deployment and prepare one grouped live-validation
  batch with a cost estimate."* So a batch that passes review is not merged
  or deployed on its own: passing review is not live confirmation, the next
  batch builds on the same branch, and one deploy then carries them all,
  followed by one grouped live batch, priced before any press.
- **One hand-over contract wherever work moves between steps** (the same
  order, starting batch 2): *"preserve every part of a mixed request across
  routing conversions, failures, edit/add-on handoffs and escalation to a
  full rewrite … Use a consistent handoff contract across these paths, with
  models deciding intent and code validating and dispatching—no keyword
  rules or site-specific exceptions."* So every place a request moves (a
  reader converting an answer, a step handing on, a failure, a climb to
  the full rewrite) carries the same things: the part that runs now, the
  part put off, the scope, and why it moved. What was put off is said on
  every final outcome, never run by a later step, and never lost.
- **A part put off survives background work, and no step that runs is
  handed it** (2026-10-02, the review of batch 2): *"persist every deferred
  part through background rewrite storage, resume, retries, and final
  success/failure replies so the browser still reports it … ensure newly
  deferred instructions are excluded from every executing step's model
  input, including overlapping scope words and removal-door steps that fall
  back to eRun … asserting both the actual model inputs and complete
  deferred reporting."* So the parts put off live in every stored record a
  later invocation finishes from, and are named on whatever answer it
  finally writes and on the screen. What each executing step's model is
  actually handed is what gets checked, not only what the dispatcher saw,
  and a test asserts those requests directly.
- **On a site that exists, the model may ask one targeted question instead
  of guessing; the first build keeps its own interview** (2026-10-02):
  *"Implement model-driven clarification for existing-site edit and add-on
  requests only; preserve current first-build behavior. Let the router ask a
  targeted question when missing information materially affects which path,
  target, or operation to choose, instead of converting clarification into
  add-on work … Clear requests should proceed directly, technical failures
  should remain technical failures, and intent and questions must come from
  the model without customer-keyword or site-specific hardcoding."* So a
  question is never turned into paid work, and code never decides from the
  customer's words whether to ask: the router or a step's model asks, code
  keeps the question and checks an answer against it. An answer resumes the
  original request with its files, scope, parts put off and completed work
  kept, without repeating changes or charges; a cancel, a changed request and
  a stale answer start nothing; a store or model failure is said as ours, not
  dressed as a question.
- **Never show a question its answer cannot resume, and never ask the same
  thing twice** (2026-10-02, the review of that round): *"Remove the
  two-question dead end: never display a question whose answer cannot resume
  the original request; retain an answerable continuation, with protection
  against repeating the same unanswered question. Make request replacement
  and question transitions reliable: do not continue with a replacement when
  closing the old question fails or loses a race, and preserve recoverable
  state if storing the next question fails."* So there is no question
  budget: a question is shown only with something waiting for its answer,
  and a question the request already asked, or one no answer could fit
  beside, ends the request with a plain sentence instead. A new message never
  goes on while the old question is still open, and an answer is never used
  up by a write that failed. Every model that decides a change may ask
  (*"Extend clarification into the edit models and add-on designers"*), and
  a prompt never tells a model to guess beside a field that tells it to ask
  (*"Reconcile contradictory prompts, including the add-on picker's
  instruction to choose the closest kind"*). What a resumed request's models
  are actually sent is what gets checked (*"verify actual resumed model
  inputs and that completed changes and charges never repeat"*).
  (**The ending is superseded by the second review**, below: a question
  already asked, or a long request, no longer ends the request.)
- **What they already told us stays with the work still to do, beside the
  request, never in it; a repeated question is reused or asked better,
  never an ending** (2026-10-02, the owner's second review): *"Preserve the
  answers relevant to unfinished operations while excluding completed
  operations from execution; keep clarification context separate from
  executable instructions, with the model identifying its relevant scope
  rather than customer-keyword rules. Also replace the terminal
  clarify-repeat/question-ended behavior: when an answer did not resolve the
  ambiguity, retain the pending request and let the model ask a more
  specific follow-up; when the answer already exists, reuse it instead of
  asking again. Prevent repeated-question loops without discarding the
  request or requiring the user to retype it."* So the answers travel as
  their own list beside the request and are shown to models as details,
  never as a change; which answer belongs to which change is the model's
  reading, and code checks only that it is in range; an answer only a
  finished change needed is never shown to a model again, but is still used
  if the same question comes back; a question already answered goes back to
  its model with the answer; one an answer did not settle is asked more
  specifically while the request waits; and a loop is stopped by offering
  the model no question, never by ending the request or making the customer
  type it again. (**The loop stop is superseded by the third review**,
  below: offering no question made the model act on a guess.)
- **No question limit and no repeated question is ever permission to act**
  (2026-10-03, the owner's third review): *"Never treat a question limit or
  repeated question as permission to act. If a model still needs
  clarification, preserve the pending request, relevant answers, unfinished
  operations, and attachments; suppress changes accompanying that
  unresolved question. Stop automatic retry loops while keeping a
  user-driven way to clarify or cancel, without requiring the original
  request to be retyped. Apply the same rule to the router and downstream
  edit/add-on calls."* So every model call is offered its question, a reply
  that asks is never stripped of its question, and nothing it proposed
  beside the question is made, published or charged; at a limit, what stops
  is our own re-asking of the model — the question goes to the customer,
  with everything the request needs kept, and only their answer or their
  Cancel moves it on. The same holds at the router, every edit step and
  every add-on call.
- **The answers a customer gave are a history, never a window**
  (2026-10-03, the owner's fourth review): *"appendAnswer must not discard
  an answer needed by unfinished work merely because 12 answers already
  exist. Separate the stored clarification history from any bounded
  model-input window; preserve relevant answers durably and retrieve them
  for the operations that need them. Do not infer irrelevance from age or
  assume a later answer to the same question replaces all earlier
  details."* So a limit on how often we ask is never a limit on what we
  keep: every answer stays with its request on every hop; none is dropped
  for being old, or because the same question was answered again later
  (each answer can carry its own detail); each model is shown the answers
  retrieved for its own operation; and where a size bound has to exist, it
  refuses something new, at no cost and with nothing lost, rather than
  forget something the customer gave.
- **Normal customer-facing messages are written by a model from verified
  facts; fixed sentences only for failures of ours** (2026-10-03): *"Make
  normal customer-facing messages throughout edit and add-on model-written
  … Code must supply structured, verified facts about what changed, what
  failed, what remains pending, and whether input is needed; the model
  should explain those facts naturally using the conversation and site
  context, without inventing outcomes or changing execution decisions. Keep
  fixed messages only for genuine technical failures such as model/provider
  outages, network errors, or unavailable services; an HTTP status alone
  must not turn a normal product outcome into that exception. Reuse existing
  model calls where practical and report any added latency or credit cost. A
  reply-generation failure must never rerun completed work."* So the code
  decides and does the work, then states what really happened as facts; a
  model only puts those facts into words, and a reply that leaves a fact out
  is not used; whether a failure is ours is read from what the answer says,
  never from its status; and when no reply can be had, the answer goes out
  as it was, with nothing redone.
- **The reply model gets the complete outcome, and nothing is cut at an
  arbitrary limit** (2026-10-03, reviewing the replies): *"stop cutting off
  pending requests, failed additions, and facts after arbitrary limits. Pass
  the complete outcome to the model and clearly instruct it to explain what
  succeeded, what failed, what remains pending, and what needs an
  answer—without claiming unfinished work is complete. Let the model write
  naturally and summarize without hiding material details. Keep this small:
  no new layers, hardcoded customer messages, or routing changes."* So no
  list is cut at a count, no sentence at a length, and no fact is left out of
  what the model is shown; the model may summarize, but names every change,
  failure, waiting part and question.
- **Natural conversation, with no limit that loses meaning; safeguards kept
  and explained** (2026-10-03, ordering the information-limits audit):
  *"Our goal is natural conversation without arbitrary restrictions that
  lose meaning: requests must not be silently shortened, relevant answers
  must remain available while unfinished work needs them, and completed
  work, failures, pending operations, targets, questions, and billing facts
  must not disappear because a list is long. … reaching a threshold must
  never force guessing, repeat completed work, or abandon the pending
  request without explanation. Keep necessary technical safeguards for
  resource usage, provider context/output budgets, payload size, execution
  time, retries, and spending, but explain the evidence for each safeguard
  and what happens when it is reached. … do not assume model-reported
  coverage proves the wording is accurate. Prefer complete authoritative
  inputs and clear model instructions over extra rule layers or hardcoded
  customer messages."* So a limit either refuses with its reason or keeps a
  count of what it left out, never cuts silently; a limit on our automatic
  retries is never a limit on the customer going on; a safeguard is kept
  with its evidence and its outcome said; and a model's own claim that it
  covered everything is not proof that it did.
- **One size policy from real constraints; past it, keep everything and
  run nothing shortened** (2026-10-03, ordering batch 1 of the limits
  plan): *"remove the arbitrary 2,000-character request and 500-character
  clarification-answer restrictions throughout the affected browser,
  server, model-input, persistence, queue, and resume paths; do not merely
  replace silent clipping with rejection at those same numbers or raise one
  constant while another hop still cuts the input. Use a consistent
  technical size policy supported by actual request, storage, and
  model-context constraints, and document its rationale. Within that
  supported budget, preserve the complete input; beyond it, preserve the
  draft and pending state, explain the real constraint, and never execute a
  shortened request."* And for questions, files and pages in the same order:
  never cut a question mid-sentence, discard an answer offered, or send a
  shortened option as their answer; never silently choose which files to
  discard, and report a genuine file limit before anything runs; route on
  the site's own complete page list, never on a partial browser copy, and
  never read an unreadable inventory as a missing page. So every hop reads
  one budget (`builder/input-budget.mjs`), whose numbers are tied to the
  constraint each comes from.
- **Keep the classes of a finding apart, and an estimate is not proof**
  (2026-10-03, correcting the limits audit): *"Keep confirmed code defects,
  controlled reproductions, untested risks, and optional product
  capabilities distinct, and do not call reply-size estimates proof that
  real model replies fit."* So a record says which a finding is — read in
  the code, driven with supplied answers, plausible but unshown, or
  something the product does not do — and a measurement of inputs is never
  written up as evidence about what a real model produces.
- **Mixed work is judged by what really happened, with three things kept
  apart** (2026-10-03, ordering the mixed-work audit and pausing the limits
  batches): *"Distinguish clearly between several tasks completed from one
  user message, several model calls, and tasks actually running
  concurrently … For every scenario, compare requested operations and
  targets against actual changes, publication, pending work, failures and
  the final customer-visible reply; receiving a successful HTTP response or
  selecting a lane is not sufficient. Keep model-written wording and
  model-based intent selection: no keyword rules, fixture-specific routing,
  forced route choices presented as real-model success, or new
  orchestration architecture … Reuse completed evidence, avoid unnecessary
  restoration of demo data, and do not deploy or rebuild containers for
  controlled tests."* And of requests past the thresholds: *"keep these
  findings within this mixed-work scope instead of restarting the general
  limits campaign."* So a record says which of the three it means (one
  message, several calls, at the same moment); a test passes on the stored
  pages, look, menus, photographs, database statements, jobs, publishes,
  ledger and the reply, never on a status or a chosen lane; a supplied
  answer is said to be supplied and never written up as a real model's
  choice; and a closed test or a live reading already taken is cited rather
  than repeated.
- **Outcomes are classed by what really happened, and capability claims
  name their exceptions** (2026-10-03, correcting the mixed-work audit):
  *"twelve registered add-on kinds does not mean all twelve finish together,
  since row and frame have exceptions; storing QR/3D configuration and
  passing it to a writer does not prove placement on the requested page; and
  controlled tests with supplied answers do not prove real-model routing or
  complete delivery. Separate what was actually changed and published from
  what was only designed, stored, handed off, deferred or left unverified."*
  So a record classes every outcome as one of those six, a registered list
  is never written up as one that works together without naming what does
  not, configuration saved is never called delivered, and a supplied-answer
  result is never called real-model proof.
- **No "at most" on an estimate that nothing enforces** (2026-10-03):
  *"Remove “at most” language from cost estimates unless an enforced
  spending cap supports it."* So a cost is "about N", or "about N if …" for
  a costlier path, and the balance is named as the only bound; "at most" and
  "up to" are kept for limits the code really enforces.
- **Every operation is reported with its target, and a limit never loses
  one** (2026-10-03, ordering the mixed-work fixes): *"report every
  completed, failed, declined and pending operation with its target; and stop
  silently dropping operations at the four-lane or per-step count limits.
  Remove arbitrary operation caps where the existing execution and resource
  safeguards support processing the complete list; where a genuine limit must
  remain, preserve and identify each unexecuted operation instead of losing
  it or claiming success. Do not replace missing targets with a vague
  count."* And: *"Report QR codes, scenes and other additions as delivered
  only when the actual result supports that claim; distinguish configuration
  saved from placement verified. Preserve requested versus applied schedule
  values and explain any adjustment accurately. Keep normal replies
  model-written and avoid adding another reporting framework."* So a count
  that drops work is removed or turned into a named limit; a part not done is
  named by its words, the part of the site or its page; and an addition is
  said as shown only where the published pages show it.
- **The other half of a request should not need resending; the change to
  get there is planned before it is built** (2026-10-03): *"The goal is that
  users do not have to resend the other half solely because it belongs to
  another route. Do not implement that cross-route execution change yet,
  introduce parallel writes, or redesign the architecture; finish with the
  exact proposed change and its tradeoffs for review."* The plan is
  `docs/investigations/edit-addon-one-request-plan.md`.
- **A count is not a constraint until it is proven one; every requested
  entry is applied or named with its reason** (2026-10-03, on the mixed-work
  fixes' review): *"Do not treat “a footer should have eight items” or “a
  menu should have ten” as a proven technical constraint; remove those
  arbitrary counts where existing resource safeguards support the complete
  list, or clearly document a genuine constraint."* And: *"every requested
  entry must either be applied or retain its identity and an accurate reason
  it was not applied."* And the checks: *"checking the final page and
  customer-visible outcome rather than only the reader."* So a design number
  that drops entries is removed. A limit that stays is written down with why
  it is real. A refused entry keeps its words and its own reason, on the
  answer and in the reply. A test reads the stored pages and the reply, not
  just the reader.
- **Unfinished work belongs to the server, not to an open tab** (2026-10-03,
  on the first one-request plan): *"Reuse the existing server job runner,
  leases and idempotency mechanisms wherever possible so an accepted request
  can progress without an open browser; the browser should display progress
  and supply clarification, not be the only trigger for unfinished work."*
  So a design that relies on the page to continue accepted work is not
  proposed. Each step is a job the runner claims, leases and recovers, and
  the page follows it and answers its questions.
- **Order is the model's judgement; state is code's** (2026-10-03): *"let
  the model identify those relationships, with code enforcing execution
  state, rather than assuming textual order or inventing keyword rules."* So
  which part needs which comes from a model's structured answer. Code checks
  it, refuses cycles and decides what may run. Where a part sits in the
  sentence is never taken as a dependency.
- **Queued is said as queued; done, failed, waiting and unverified are kept
  apart** (2026-10-03): *"Report queued work as queued until it actually
  starts, and distinguish completed work from failed, waiting and
  unverified work throughout."* So nothing is described as being done, or
  done, before its own record says so. A publish that could not be
  confirmed is said as unverified, never as done.
- **Checkpoints and recovery are specified one by one** (2026-10-03):
  *"Specify routing, execution, publication and charge checkpoints
  separately, including recovery after a lost response, a crash before or
  after a publish, and duplicate requests from another tab."* So a plan for
  work that spans jobs states, for each checkpoint, what happens on each
  failure, what is charged and what the customer reads.
- **A part the customer asked for runs without another press because it
  crosses a route; a scope change is asked first** (2026-10-03, ordering the
  combined request flow): *"An explicitly requested part should run without
  another confirmation merely because it crosses an internal route; retain
  existing credit checks and ask when proceeding would materially change the
  requested scope, including a full rewrite fallback."* So a later part of a
  message spends what its own steps cost, as if sent by hand, and each step
  keeps its own credit gate. The full rewrite, and anything else that changes
  far more than the part asked for, is never started without the customer's
  own press.
- **Duplicates are proven, not inherited** (2026-10-03): *"Prevent duplicate
  execution and charging across retries, lost responses, duplicate delivery
  and multiple tabs, including the initial routing call; do not claim
  existing job recovery alone proves the new coordination is correct."* So
  new coordination gets its own tests for each of those cases, each reading
  the job rows and the ledger. The job runner's recovery is not cited as
  proof of the layer above it.
- **Finished work stays finished; unfinished work keeps an accurate status
  and reason** (2026-10-03): *"Keep completed parts completed and preserve
  every unfinished part with an accurate status and reason."* And: *"Make
  progress and questions recoverable after reopening the site or using
  another device."* So the server holds the state, and a page only shows it.
- **The smallest coherent implementation, its storage written down, and the
  exact remaining action when a step is out of bounds** (2026-10-03): *"Use
  the smallest coherent implementation, document any necessary new storage
  or infrastructure, and avoid unrelated refactors."* And: *"If a required
  step needs those, finish the reviewable code and migration first and
  report the exact remaining action."* So existing machinery is reused
  before anything new is added. Any new storage is listed with its keys and
  lifetime. A step that needs a migration, a paid call or an image build is
  prepared, not taken, and named.
- **A dependency is satisfied by what a step did, never by its `ok`**
  (2026-10-03, reviewing the combined request flow): *"distinguish genuine
  refusals and partial outcomes, and never satisfy dependencies merely
  because the enclosing response has ok:true."* So an answer that names
  anything it did not do is a partial outcome, kept apart from a refusal and
  from done, and nothing that needs it runs. Work a step sets aside is kept
  in the model's own words as work of its own, never dropped inside an `ok`.
- **Recovery is proven with nothing helping it** (2026-10-03): *"test
  recovery with no browser, resend or direct request GET, including
  interrupted marker writes."* So a recovery test removes every other way
  the work could be moved on, and crashes each write it depends on, one at a
  time.
- **A waiting approval stays attached to the work it approves** (2026-10-03):
  *"Preserve a waiting approval state and attachments, record the approval
  durably, and use the existing rewrite executor."* So an approval is a
  durable state on the request, given from any device, run by the existing
  executor and settled back into the request; never a separate browser
  action.
- **An instrument is adapted before a rollout needs it, not after**
  (2026-10-03): *"Adapt the UI canary for request mode on this branch before
  rollout, rather than leaving that implementation until after
  deployment."*
- **A lost write's answer is an outcome not known** (2026-10-03, the second
  review of the combined request flow): *"Treat a lost write response as an
  uncertain outcome; preserve files while acceptance or another concurrent
  acceptance may reference them, recover using the same request key, and
  clean up only when non-use is established."* So a write that throws
  deletes nothing. What it may have left is read back under the same key,
  and anything a record could still name is kept until none can.
- **An approval, and what finishing its work needs, are written before
  anything depends on them** (2026-10-03): *"persist rewrite approval and the
  information required to finish filing its job before depending on
  subsequent calls … Make the server recover that boundary automatically
  through the existing machinery, with one rewrite and one charge, and test
  it without another approval, resend or browser GET."* So the durable write
  comes first, and the rest is the server's own next step. A customer never
  has to press twice for work they already approved.
