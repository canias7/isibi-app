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
- **Controlled evidence is not a real model's choice.** *"Clearly distinguish
  controlled execution evidence from proof that a real model chooses the
  correct route."* Supplied answers prove what the code does with an answer;
  only a live run shows which answer a model gives.
