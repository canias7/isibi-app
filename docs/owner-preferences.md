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

