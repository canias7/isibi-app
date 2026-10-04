# The owner's review of the findings fixes: four corrections (2026-10-04)

The owner, reviewing the branch at `d5f11aef`: *"The review confirms that the
original Classes menu failure is fixed, but address these remaining issues
before merging."* Four, in their words below, and with them: *"Update the
handoff with the precise fixes and checks. Keep everything on the branch; no
merge, deployment, container rebuild or paid run yet."*

So nothing here is merged or deployed. No container image is built, and
nothing paid has run: no model call, no fal purchase, no press. `main` stays
`f69c873c`, running image `882477e1bbbe8cbe`. **Every result below is shown
with supplied model answers.** None of it is evidence of what a real model
answers.

## 1. A footer addition accounts for every page it names (`builder/site-nav.mjs`)

The owner: *"applyAdditions silently excludes explicitly requested footer
pages without an existing list when another scoped page has that list.
Reproduction on the run-95 fixture: create a legal Classes link on / only,
then call runNavEdit in addition mode with
add:[{to:"legal",label:"Classes",href:"/classes",pages:["/","/visit"]}]. It
returns ok:true, satisfied:true, changed:[], dropped:[], and claims the link
already exists on both pages while /visit still has no legal list."*

**The cause**: a footer addition chose its targets by the rule for an
addition nobody scoped, *where the site already has the list, and on every
frame only when no page has it* (`targets = there.length ? there : scoped`).
Named pages went through the same rule, so a named page whose footer had no
such list was no target, and the addition counted as already true on the one
page left.

**What changed**:
- **Every named page is a target.** A named page whose footer has no such
  list is given one, beside the frame's own; a page that has the list gains
  the entry where it lacks it.
- **A named page with no footer at all** is refused by name and never given
  one: `no-footer-there`, said as *"/starter has no footer to put
  “instagram” in, so it isn't there."* (A menu keeps its own reason,
  `no-list-there`.)
- **A target that neither had the entry nor gained it** is said, never left
  out: `not-written`, *"I couldn't write “Classes” into /visit's small-print
  links, so it isn't there."* The real writer always writes, so this is the
  last guard on "every target is accounted for" (`additionOutcome` is
  exported so its guard can drive it).
- **A home page named for a link to itself is told, with the reason.** The
  menu writer never gives the home page a link to itself unless it already
  has one (`applyNav`: measured, 1 home page in 93 lists itself), so for a
  named home page the addition is not supported there: `home-self`,
  *"“Today's bake” goes to the home page itself, and the home page's menu
  doesn't link to itself, so it isn't there."* Never counted as done. Nobody
  naming it, the home page is left out, as ever.
  - Found by the sweep: a first version made the named home page a target,
    and the writer then left it without the link. The accounting caught it
    as `not-written` — true, but without the reason — so it is now said for
    what it is.
- **Satisfied only when every target holds it.** An addition with an unmet
  named target is never `satisfied`:
  - nothing else changed: the step refuses, the part is `failed`, and what
    needed it is not run;
  - something else changed: done in part, with the unmet page in `dropped`;
    the part is `partial`, and what needed it is not run either.
- **"Already there" names the pages that had it.** *"on every page that has
  one"* is said only for an addition nobody scoped whose every target had it.
- **The default for an addition nobody scoped is unchanged**: the entry goes
  where the site has the list, a page without it may be without it on
  purpose, and the list is made on every frame only when no page has one.

**Tests** (supplied answers, run 95's pages and run 47's bakery):
- `test/request-findings.test.mjs`, the REVIEW cases: the owner's
  reproduction; named pages with lists that exist and lists that do not,
  with the unscoped default beside them; social links the same way; a named
  page with no footer, refused when nothing else changed and done in part
  when something did; the `not-written` accounting, named and unnamed, with
  "already there" naming only the pages that had it; a home page named for a
  link to itself, alone (refused) and beside a page that takes it (done in
  part, the home page kept as left out), never counted as all there, and the
  unnamed default.
- `test/edit-removal-door.test.mjs`, through the edit route, sync and
  queued: social links on named pages (a list made where a named page's
  frame has none, an entry added where it lacks one, then already done at no
  cost); legal links on named pages (one given its list, then a page with no
  footer refused, its reserve refunded).
- `test/request-flow.test.mjs`, M6, through the request driver: `/visit`
  named and met, both parts done; `/starter` named, the part `failed`, the
  part that needed it `not-run`, the request told *"Not started: …"*.

## 2. A retry is never claimed before its time (`builder/site-reply.mjs`, `worker.js`)

The owner: *"claimReply ignores a pending record's future retryAt. I
reproduced an attempt-1 record with retryAt:32000 being claimed at now:2500
as attempt 2. Enforce the scheduled retry time at the claim boundary so
duplicate or early queue deliveries cannot consume attempts or bypass
backoff; preserve eventual recovery and test early duplicates, due-time
delivery, concurrent claims and exhausted attempts."*

**What changed**: one rule at the claim, `replyClaim(rec, now)`:
- `claim`: a try is due — none yet, a writer's claim run out, or a retry
  whose time has come;
- `skip`: not this writer's — written, failed or owed nothing; being written
  under a claim that holds; or **a retry not yet due**, so a duplicate or
  early delivery spends no try and skips no wait;
- `fail`: past the 15-minute horizon, or the tries spent.

`claimReply` asks it before anything is written. The only allowance is
`REPLY_RETRY_SKEW_MS` (2 s), for two machines' clocks. A retry's own message
still comes at its time; one lost is asked again by the two-minute cron once
its time and the grace (90 s) are past.

**Tests**:
- `test/reply-background.test.mjs`:
  - BG9, the rule itself: the owner's reproduction is skipped; at the
    retry's time, or within the clocks' allowance, it is claimed; a holding
    claim is never taken and a lapsed one is; spent tries and the horizon
    fail it;
  - BG10, through the queue: a retry's message delivered early, twice,
    leaves the record untouched (the same etag) with no model call;
    delivered at its time, twice at once, one claim (attempt 2) and one
    call; a lost timed copy recovered by the cron after the retry and the
    grace; spent tries take nothing from a late copy;
  - BG2 delivers each retry at its time, as the queue does.
- `test/model-replies-routes.test.mjs`: the queued failed-reply case
  delivers an early copy first, which leaves the record pending at attempt
  1, then each retry at its time.
- The harness (`test/fixtures/request-flow.mjs`) keeps each queue message's
  send time and delay, and `pump`/`settle` take `{ due }` to deliver only
  what is due.

## 3. The page applies the outcome at once and follows the reply on its own (`public/edit-poll.js`, `public/chat.js`, `builder/site-reply.mjs`, `worker.js`)

The owner: *"finish separating completed work from reply generation in the
UI: apply the completed result and refresh the preview as soon as the
authoritative job outcome arrives, while continuing to follow the
model-written reply independently. Do not make the preview wait through
reply retries, and do not display "Done" for a failed or refused operation
simply because its explanation is pending. Verify reload and duplicate polls
cannot apply results or append replies twice."*

**Before**: a queued edit, add-on or request part whose reply was still being
written was waited for. The preview, the page list, the undo offer, the
credits and the send box all stayed as they were until the reply was written
or failed, up to the reply's 15 minutes of retries. The live line said
*"Done — writing up what changed…"* over every ending, a refusal's too.

**What changed**:
- **The outcome is applied the moment it arrives**, by the same reader as
  ever (`editAnswer`, `addonAnswer`): the preview reloads, a removed page
  leaves the picker, the undo offer is kept, the credits refresh, the send
  box is freed and the live steps stop. The job's resume record is
  forgotten there, so a reload never applies it again.
- **The reply's place on the thread is held** by one line
  (`EditPoll.holdReply`), chosen from what the job really did:
  - the server reads that from the very facts its reply writer is given
    (`replyOutcomeOf`) and serves it with the pending answer
    (`replyOutcome`);
  - *"Done — writing up what changed…"* only for `done`; *"Partly done —
    writing up what changed and what didn't…"*, *"That didn't go through —
    writing up why…"*, *"A question first — writing it up…"*, *"Nothing
    changed — writing up why…"* for the rest;
  - the page says "Done" only where the answer's own `ok` is true as well,
    and *"Writing up what happened…"* where the word is missing or does not
    read;
  - a question's card is drawn at once, under the line.
- **Which endings hold their place**: those whose reader shows a written
  reply — a success, a question, a refusal (`replyTellsEnding`). An edit
  under review, an answer the page cannot read, a receipt and a hand-over are
  said or acted on at once, as before.
- **The reply is followed on its own** (`editReplyFollow`): the same poll,
  which never calls the model. Written, the line becomes the reply where it
  stands, above the question's words. Failed, the job gone, or the page
  looking past the server's last try (`REPLY_WATCH_MS`, 20 minutes, above
  the server's horizon, a try's deadline and the sweep's grace): the line
  becomes the page's own sentence for the outcome, which the message kept. A
  poll that fails is looked at again.
- **Request parts the same way** (`siteRequestJobReply`): a part's outcome is
  applied and its place held, and the parts after it are shown at once. Only
  the request's own reply, still being written, keeps the page reading the
  request.
- **Once, however often it looks**: the job's watch has its one-shot latch;
  the resume record is gone once the outcome is applied; one follower per
  site and job; the held mark on the message is the settle's latch; a request
  part is marked shown before it is applied. A reload follows the held
  message again (`siteHeldRepliesCheck`, on the same render as the other
  resumes) and applies nothing.
- `EditPoll.waitingMessage` is back to its one meaning, a job queued behind
  another change or a platform update.

**Tests** (supplied answers):
- `test/reply-held-page.test.mjs`, new, 24 cases, the page's own functions
  run with the real `edit-poll.js`:
  - the preview, the latch and the send box freed at once, the line held,
    a retry, then the reply in its place, nothing applied twice;
  - the next message sent while the first reply is written, each reply in
    its own message's place;
  - a refusal never says Done, and its own sentence is said if the reply
    fails;
  - the line table and the server's word, one per kind of ending;
  - **the parity guard**, 11 endings (success, wording, partial, refusal,
    question, success with a question, already there, under review,
    unreadable, an addition, a refused addition): held then written ends
    exactly where the written reply on the first answer would, held then
    failed exactly where the failed one would, and the outcome is applied
    once either way;
  - duplicate looks (renders, the resume, a second follow) follow one reply
    once and add no message; a reload while the reply is written; a reload
    before the job ended; a reply that never comes; a job gone; a poll that
    fails;
  - the thread draws the held line as the live steps' waiting line.
- `test/request-flow-page.test.mjs`, through the real Worker on the stateful
  platform:
  - PAGE 7, rewritten: part 0's outcome applied (the preview moved) and its
    place held while part 1's reply is shown under it; once written, part
    0's reply takes its place, in order, once, and another device shows the
    same;
  - PAGE 9, new: a reload while a part's reply is written applies no part
    again, follows the held reply and settles it once;
  - PAGE 10, new: a part that did not go through holds its place with *"That
    didn't go through — writing up why…"*, never Done, while the part that
    went through is shown.
- `test/reply-background.test.mjs` BG11: the word rides every read while the
  reply is written (`done` for the part that went through, `not-done` for the
  failed addition) and is gone once it is written; BG1 reads it too.
- `test/model-replies-routes.test.mjs`: the queued cases read the word.
- **Screenshots**, the real `public/` app in headless Chromium with every
  server answer supplied: the success held (*"Done — writing up what
  changed…"*, the preview already reloaded at `?v=4`, the send box free),
  then written in place; a refusal held (*"That didn't go through — writing
  up why…"*), then the page's own refusal sentence once the reply failed.

## 4. One press for R2–R5 (`rq-batch-r2`; `scripts/canary-batch.mjs`, `scripts/edit-canary.mjs`, the workflow)

The owner: *"prepare a minimal continuation option for rq-batch starting at
R2 so we can run R2–R5 in one press after the focused check, preserving
sequential execution, failure stops and the existing spending threshold
without repeating R1 or rq-canary."*

**What changed**:
- **A second batch name**, `rq-batch-r2`, runs `rq-2-wholesale`,
  `rq-3-facebook`, `rq-4-logo` and `rq-5-away`, in that order, through the
  same driver as `rq-batch`. It shares the presses, their upper estimates and
  the threshold of 100 between presses. Each press is the canary run once, as
  its own process with its own checks and evidence; the next starts only
  once the last has exited. It stops before a press past 100, after a press
  that fails, and after one whose spend cannot be read.
- **Each press keeps its number in the plan** (`n`), so the log and
  `batch.txt` say R2–R5, and `batch.json` names the batch.
- **Its box counts what the batch has already spent**: rq-canary's 4 and R1's
  21, plus the focused check's. Under 25 it is refused before anything is
  signed in or pressed, so the threshold can never count from too low.
- **The form**: the scenario box names `rq-batch-r2`, the batch box's
  description names both batches and what to put in it for this one, and the
  run's limit is 180 minutes for either batch name (45 for every other run).
  The continuation's worst case is four of the five presses, inside the same
  limit with more to spare.
- `rq-batch` itself is unchanged, and `rq-canary` and R1 are pressed by
  neither.

**Tests** (`test/canary-batch.test.mjs`, the real canary script run with a
stand-in press): R2–R5 exactly, never R1 or rq-canary; in order, one at a
time, each told by its own number; stopping after a failed press, after one
with no record, before one past 100 (from 40 at the upper estimates: 65, 77,
84, and R5's 17 would make 101) and before R2 itself; the box's floor; the
plan's own case (25, the focused check's 9, then R2–R5's 61: 95, every press
made); the form and the limit. The existing guards in
`test/canary-batch.test.mjs` and `test/canary-requests.test.mjs` read the new
expression and the new import.

**The press**, after the focused check, "Use workflow from" `main`:
- "Run the ONE paid edit as well (yes/no)": `yes`;
- "RUN A NAMED SCENARIO IN A REAL BROWSER instead of the one edit: …":
  `rq-batch-r2`;
- "REQUEST BATCH ONLY (rq-batch, rq-batch-r2): …": 25 plus what the focused
  check cost, read off its money check;
- "The site to edit. …": `fold-lane-bakery`;
- the deploy sha box and the image box as the deploy's record names them;
- every other box blank.

## 5. Two dated tests, on a fixed clock (`test/site-jobs.test.mjs`; test only)

The full suite turned up two failures nothing in this round touched: the
Jobs panel's one-time job is dated 3 October 2026 at 09:00 London, and from
08:00 UTC on the 4th, past its day's grace, both cases that call it
"scheduled" read "missed". The same class as the add-on route's one-time
jobs, fixed in `dd632b96` the same way: those two cases run on a clock fixed
at 2026-10-02 12:00 UTC (`t.mock.timers`, Date only).
- On the old code, with the old test file, today: both fail.
- On the old code, with the fixed clock: both pass.

## 6. Found, kept separate (the backlog)

- **The preview's first refresh on a site with no stored version keeps
  `?v=1`.** `sitePreviewSrc` defaults a missing `previewV` to 1, and the
  first bump makes it 1, so that frame's address is unchanged. Published
  pages are served `public, max-age=60`, so the frame may show the cached
  page for up to a minute after that first change. Older than this round and
  the same before and after it. Not changed.

## 7. Checks

- **Red check** on `d5f11aef` (the branch before this round), in a throwaway
  worktree, this round's tests copied in; the files that import this round's
  new exports were given stand-ins (or the old page harness), so each case
  shows on its own:
  - **every new or converted case fails, with two explained exceptions**:
    - item 1: 5 of the 6 REVIEW cases, the 4 named-page cases through the
      edit route (2 per path), and both M6 cases;
    - item 2: BG9 and BG10, and the queued failed-reply case;
    - item 3: PAGE 7, 9 and 10, BG1 and BG11, and the queued success case
      that reads the word (the failed-reply case above reads it too);
      `test/reply-held-page.test.mjs` cannot load there, since every case in
      it is new;
    - item 4: the 5 continuation cases, and the 5 batch guards that read the
      new number, form, limit, hand-on and record;
    - the guards re-anchored to the new code (2 in
      `test/addon-queue.test.mjs`, 1 in `test/edit-poll.test.mjs`, 1 in
      `test/canary-requests.test.mjs`).
  - **the two exceptions**:
    - BG2 passes on both: converted to deliver each retry at its time, it
      holds the same property it always did;
    - the social-links REVIEW case passes on both: its named page already
      had a list, which was never the bug's shape. It stays as the social
      coverage the owner asked for; the social case with a missing list is
      the edit route's, and fails on the old code.
  - **no unchanged case fails**.
  - The two dated Jobs-panel cases fail on the old code with the old test
    file today, and pass with the fixed clock: the calendar, not the code.
- **Sweeps**, from a green baseline, every anchor checked first, every file
  restored by hash:
  - **the round**: 37 mutants across the four items and 6 comment-only
    controls. **34 killed**: all 5 of item 2's, all 19 of item 3's, all 6 of
    item 4's, and 4 of item 1's 7. **Every control survived.** The 3
    survivors were item 1's test gaps: the `not-written` accounting, the
    "already there" wording beside it, and a home page named for a link to
    itself.
  - **the gaps closed**: `additionOutcome` exported for its guard, two cases
    added, and the home page's case said with its reason (§1). The follow-up
    sweep: **8 of 8 killed** (the two re-anchored survivors and six for the
    home page's reason), 2 of 2 controls survived.
  - One mutant (a request part waiting for its reply again) left the reply
    writer's timers running after its cases failed, so that run took 2.5
    minutes to end: killed all the same.
- **The full suite**: `9381 / 9381 / 0 / 0`, from 9,335 by 46 new cases (24
  in the new file, 6 REVIEW, 4 through the edit route, 2 M6, 3 BG, 2 PAGE, 5
  for the continuation).
- **Money**: balance 95, last ledger row 367, no job open (read at 17:40
  UTC), as before this round.
