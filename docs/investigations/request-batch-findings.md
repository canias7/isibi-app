# Run 95's two findings, looked into (2026-10-04)

The owner, after run 95's R1 (`docs/history/2026-10-04-request-batch.md` §3):
*"yes look into both problems"*. Free: the code read, run 95's own records
(its evidence and its workflow log, with timestamps), and both reproduced with
the product's own functions on what run 95 recorded
(`test/fixtures/run95-r1.json`) and supplied model answers
(`test/request-findings.test.mjs`). No model was called and nothing was
spent.

**Both are now fixed on the branch, on the owner's word** (*What is fixed*,
below): not merged or deployed, no image built, nothing paid run, and shown
with supplied model answers only.

**Since: merged and deployed (deploy 2183), shown live by runs 97–99, and
closed by the owner (2026-10-05)** (*Run 97, live* and *Closed*, below): F1
is fixed live (run 97, and R2's menu link in run 99); F2 is shown live for a
part's job (run 98) and on the page, three replies settling in place after
their requests ended (run 99). Run 97's own reply check had failed on the
canary's timing alone.

## F1. The menu link was refused (`no-menu`): cause found, reproduced

**What happened in R1.**
- The router held the menu link back and ordered it after the page.
- The add-on made the Classes page (job `073e0a57…`). Its one other change
  was a line in `index.tsx`: `{ label: "Classes", href: "/classes" }` put into
  the home page's header menu, before *Order*. The new page copied the home
  page's frame, so it has the link too.
- The menu link's own part was routed to the add-on (routing job
  `1964a100…`). The add-on's job (`1de75e3f…`) handed it to the menu step as
  an addition (`nav`, `frame`).
- The menu step (`ac0a5b9f…`) refused: `no-menu`, *"I couldn't work out what
  the menu should be."*, refunded.
- So *Classes* is in the menu on `/` and `/classes` only.

**The cause, in two layers.**
1. **The add-on links a new page from one page.** Its page step tells the page
   writer *"Link it from the header menu: return that page too, with the link
   added and nothing else changed"* (`addDirective`, `builder/site-add.mjs`).
   In this kit every page carries its own copy of the menu (the `links` in each
   page's header). So the page writer added the link to one page, the home
   page, and the menus now differ from page to page. The directive is the same
   for any new page linked from the header menu, with or without a separate
   menu part.
2. **The menu step cannot finish a link some pages already have.** It shows
   the model one menu, the union of every page's (`menuUnion`), and for an
   addition it keeps only what that union lacks (`frameNow`: *"an item is new
   only when no page's menu carries it"*; `additionOnly`). *Classes* was in the
   union because two pages had it, so nothing in any answer was new, and the
   step refused with a sentence that does not say why.

**Reproduced, free.** The real `runNavEdit` was run on R1's six stored pages
after the run, asked as an addition with an answer adding *Classes*. It
answered `no-menu`, the same sentence word for word. Both answers a model
could give fail the same way: the union it was shown, or one page's menu with
*Classes* added.

**Why the obvious one-line fix is wrong.** "An item is new while some page's
menu lacks it" would also count *Gallery* as new: `/order` and `/visit` have no
Gallery link, on purpose. A model answering the whole menu would then put
Gallery on those pages too, a change nobody asked for. A whole-menu answer
cannot say "add this one item where it is missing".

**The proposed fix** (product; on the owner's word):
1. **The add-on puts a new page into every page's menu, by code.** When the
   page is linked from the header menu, the menu step's own per-page writer
   for an addition (`withAdded`, which skips a page that already has the item)
   adds it to every page. The page writer is no longer asked to edit one
   page's header for it. A page linked from somewhere else (*"a button on the
   home page's closing band"*) is edited as now.
2. **For an addition, the menu editor names only the items to add**, not the
   whole menu.
   - Each item is added to every page whose menu lacks it, and a menu that
     differs by design keeps its differences.
   - An item every page already has finishes as already there: nothing
     changed, and its charge refunded as a refusal's is now.
   - This also finishes a link left on some pages, like the bakery's
     *Classes* now.

With both, R1's message ends with the link in all five menus, and its menu
part done with nothing left to do. (R1's site has six pages but five menus:
`/starter` has none, and is given none.) The tests to write first:
- R1's shape through the real routes, sync and queued;
- a menu that differs by design (Gallery) coming out unchanged except for the
  new link;
- the bakery's half-linked *Classes* finished on the other pages.

**The bakery now**: `/order`, `/visit` and `/gallery` have no Classes link.
Under the demo rule it stays as it is unless the owner asks. Until fix 2, a
menu edit asking for *Classes* is refused the same way.

## F2. The parts got no model-written reply: the reply call ran out of time

**What happened in R1.** The page read each part's finished job once (`GET
/api/site/edit/<job>`). All three results came back with no `reply` or
`replySource`, so the page showed the old fixed sentences. Run 94's single
part's result came back with one (`replySource: "model"`).

**What is ruled out.**
- **The reply's context was stored with each result.** Each job's stored
  answer carries its `replyFor`, flagged `inRequest`, as run 94's did.
- **The poll does write replies.** It passes every finished job through
  `servedModelReply`, which takes the context off and writes the reply. The
  page's first read in R1's press, of run 94's job, came back with run 94's
  kept reply, so replies were switched on.
- **Nothing was skipped.** The real facts builders (`editReplyFacts`,
  `addonReplyFacts`) give three facts for each of R1's results: part 0's
  description and the two parts it put off; part 2's two changes and its
  coverage note; part 1's refusal and its two money facts. They are short:
  318 to 486 characters.

**What the timings show.** The run's own records time each job read:
- **The page's reads.** The page's follow loop does one thing at a time: it
  polls the request, reads each finished part's job, then waits. Two reads
  can be timed from the poll that showed the part finished to the job's
  answer:
  - part 0: 02:53:34.747 → 02:53:46.991, **12.2 s**;
  - part 2: 02:59:01.187 → 02:59:13.483, **12.3 s**;
  - part 1's read ended at 03:00:45.764, but its start cannot be told apart
    from the canary's own polls of the request.
- **The canary's own reads.** After the press, its job records read every
  job through the same route, and the workflow log stamps each one:
  - the three jobs with a reply to write took **12.97 s** (`ac0a5b9f…`),
    **13.13 s** (`073e0a57…`) and at most **13.20 s** (`4ad20b96…`);
  - the three with nothing to write took **0.75 to 1.23 s**: the two routing
    jobs, and the add-on's hand-over, whose reply the page never shows.
- **Run 94, for comparison**: its one-fact reply was written in about
  **5 s** on the same route (02:20:17.248 → 02:20:22.463).

**Why 12 s is the ceiling.** A reply call has its own ceiling of 12 s
(`REPLY_CALL_MS`), an abort timer on the call itself, under the 20 s the
whole reply may take (`REPLY_DEADLINE_MS`).
- When the abort timer fires, the writer reads the error as `send`: only its
  own 20 s timer counts as `deadline`. It does not try again.
- A reply that is not written is not kept, so every later read starts again
  from nothing.

So six attempts, the page's three and the canary's three, each ran into the
12 s ceiling and fell back. The customer waited 12 s longer for each part's
answer and then read it in the old wording.

**Not known**: why these replies took more than 12 s when run 94's took
about 5 s. They had three facts each against one, but whether the model was
slower that night or wrote more cannot be told without calling it. A call that
is cut off reports no tokens.

**To confirm it, free (the owner)**: Cloudflare → Workers & Pages →
`isibi-app` → Logs, searching `reply:` from 02:53 to 03:02 UTC on 2026-10-04.
Workers Logs are kept only a few days.
- Six lines are expected: at about 02:53:47, 02:59:13 and 03:00:46 (the
  page's reads), and between 03:01:30 and 03:02:00 (the canary's).
- Each should read like `reply: edit fell back (send) facts 3 attempts 1
  tokens 0/0 ms 12…` (`addon` for `073e0a57…`).
- Any other reason, or tokens above zero, would change this conclusion.

A canary press in its read-a-job mode would not settle it: its record prints
the poll's status, not its body or how long it took.

**The fix, two ways** (product; on the owner's word, best after the log line
confirms it):
- **The smallest**: let a queued job's reply call use the whole 20 s the reply
  is already allowed, instead of 12 s. Whether 20 s is enough is not known, and
  the customer still waits for it on every part.
- **The better one**: write a queued job's reply as soon as the job's money is
  settled, instead of when the page reads it. Nobody waits for it, it gets the
  time it needs, and the poll hands back the kept reply as it already does.
  It still states the row's final money, the reason a job does not write its
  own reply today. It is a larger change: the queued job's ending and the poll,
  with tests through both.

Either way, the reply log line already carries each reply's `ms`, so real
replies' times can set the ceiling instead of a guess.

## The fixes: approach (2026-10-04, on the owner's word)

The owner: *"Proceed with fixing both findings on the current branch …
document your implementation approach and complete the work without stopping
for another plan approval."* Their corrections are part of it: newness never
from the union of every page's links (the same `newItems` logic reached the
footer's legal and social lists); `/starter` has no menu, so R1's site has
five menus, not six, and no navigation is created there; the add-on carries
the link's placement explicitly; an addition already true finishes as done;
the reply is written in the background on the server, with its own progress,
deduplicated, bounded and recovered, and no read calls the model. Nothing is
merged or deployed, no container is rebuilt, and nothing paid is run.

**F1, the addition contract.**
- **The model names the additions.** In addition mode the menu step's tool
  offers one field for the menu and the footer lists, `add`: each entry names
  its list (`menu`, `social` or `legal`), the item (its words or network, and
  its address), its scope (`pages`, only the pages they named; left out, every
  page that has that list) and, optionally, the item it follows (`after`).
  The whole-list fields are not offered in this mode, so an answer cannot
  restate a menu.
- **Code adds each one where it is missing.** Each addition goes into every
  list in its scope that lacks its address: after `after` where that list has
  it, else at the list's end. Every other item, label and order stays, so a
  menu that differs by design keeps its differences. Newness is decided per
  list; the union no longer decides anything.
- **No navigation is created.** A page without a menu is never given one;
  named in the scope, it is reported as not done. A footer list gains the
  entry where it exists; when no page in the scope has that list yet, the
  first entry creates it on every page with a frame in the scope, as before.
- **Already true is done.** When every addition is already in every list in
  its scope, the step answers `ok` with `satisfied`, nothing changed and
  nothing published. A queued job takes no reserve for it, the same net as a
  refusal's refund; the synchronous path keeps a refusal's rule; routing
  charges stay. The request part is done, so what needs it runs. A button or
  a footer detail named that the frame already has counts the same way.
- **The add-on carries the placement.** A page's design names
  `link: { in: "menu" | "page", page, where, label, after }`. `menu`: the
  builder adds the page to every existing menu by code, the new page's own
  included, and the page writer is told not to edit other pages for it.
  `page`: the page writer links it from that page or place, as before. Left
  out, `menu`, the existing default. A design written the old way, as words,
  is the page writer's placement in those words, as today.

**F2, replies written on the server (option B).**
- **The reply has its own record**, `edit-replies/<job>.json`: its state
  (`pending`, `writing`, `written`, `failed`, or `none` for nothing to say),
  attempts, lease, next try and last reason. It is separate from the job
  row's work state.
- **Asked for when the job's outcome and billing are final**: after
  `edit_finalize` or `edit_refund`, and after the request has moved on. In
  the Worker directly; in the container through the gateway's new `/reply`,
  bound to the job's own token. Asking creates the record conditionally and
  sends one `edit-reply` queue message.
- **Written by the queue consumer**, a non-HTTP invocation with fifteen
  minutes:
  - it takes a lease by compare-and-swap, so concurrent attempts are one;
  - it writes with a budget fit for the background: 90 s a call, 150 s an
    attempt, two calls at most per attempt;
  - it keeps the reply, or tries again after 30 s and 120 s (three attempts),
    then marks it failed;
  - it never holds the site's lock or touches the job row, so later parts are
    not delayed and nothing is run again.
- **A read never calls the model.** The poll hands back the kept reply, or
  `replyState: "pending"` or `"failed"`. A read that finds no record, or a
  stale one, only asks for it: the same conditional create and one message.
- **Recovered without a browser.** The two-minute cron finds recently
  finished jobs with no record, a lapsed lease or a missed retry, and asks
  again. A record past its horizon (15 minutes) is failed.
- **The request's own reply** (at its end, or waiting on a go-ahead) uses
  the same record and writer, asked when the request ends or waits.
- **The page waits for the reply.** A final answer with `replyState:
  "pending"` keeps it waiting, the live step reading *"Done — writing up what
  changed…"*; a later read brings the reply, after a reload or on another
  device the same. `failed` gets the fixed wording, as a technical failure.
- **Synchronous replies**, on the customer's own connection: 30 s a call and
  45 s in all, up from 12 and 20.
- **The cause stays strongly inferred.** This session has no access to the
  Worker's logs, so run 95's timeout is inferred from the timings; nothing
  here depends on the log line.

## What is fixed (2026-10-04, on the branch; not merged or deployed)

Everything here is on `claude/help-needed-ehlwlj`, for review. Nothing is
merged or deployed, no container image is built, and nothing paid has run.
**It is shown with supplied model answers only**: no real model has filled
`add`, chosen a placement or written a reply under the new budgets. That is
the focused live check's to show (*The next live steps*, below).

**F1, the menu link.**
- **The menu step's addition** (`runNavEdit`, `builder/site-nav.mjs`). The
  model names each addition in `add`: its list (`menu`, `social`, `legal`),
  the item, its scope (`pages`) and, optionally, the item it follows
  (`after`). `readAdditions` checks each one: an address the site has or an
  outside link, and scope pages the site has. `applyAdditions` puts it into
  every list in its scope that lacks it, after `after` or at the end. In
  addition mode the whole-list fields are not offered, and nothing reads the
  union of the menus any more (`frameNow` keeps the buttons and each page's
  own contact details).
- **An ordinary menu edit takes `add` too**, so a link routed straight to the
  menu step is added the same way.
- **No navigation is made.** A page with no menu is never given one; named in
  a scope, it is refused by name. A scope page the site does not have is
  said as that. A footer list gains the entry where it exists, and is made
  only when no page in the scope has one.
- **Already true is done** (`satisfied`): `ok`, nothing changed, nothing
  published. Queued, no reserve is taken, so the step costs 0. Synchronously,
  the reading is charged, as a refusal's is. Routing charges stay. A request
  part ends done, so what needs it runs.
- **The add-on carries the placement** (`builder/site-add.mjs`, `worker.js`):
  `link: { in: "menu" | "page", page, where, label, after }`.
  - `menu` is the default. The builder adds the page to every existing menu by
    code once the pages are written, and the writer is told not to edit other
    pages for it.
  - `page`: the writer is told that page and that place.
  - An old design written as words is a placement on a page, never the menu.

**F2, the replies.**
- **The reply has its own record**, `edit-replies/<job>.json`; a request's
  own reply sits beside its request. The record's states are `pending`,
  `writing`, `written`, `failed` and `none`, separate from the job's.
- **Asked for once the job's outcome and money are final**:
  - in the Worker, after `edit_finalize` or `edit_refund` and after the
    request moved on;
  - from the container, through the gateway's new `/reply`, under the job's
    own token.
- **Written on the queue**, as `edit-reply` messages:
  - a claim by conditional write, with a lease of 150 s + 60 s, so
    concurrent attempts are one;
  - 90 s per call and 150 s per try, two calls at most per try;
  - three tries, 30 s and then 120 s apart, then `failed`;
  - it never holds the site's lock or touches the job row.
- **A read never calls the model.** The job poll and the request read hand
  back the reply, or `replyState: "pending"` or `"failed"`. A read that finds
  no record, or a stale one, asks once: the same conditional create, one
  message. A job that ended more than two hours ago is not asked for one: it
  gets its plain answer. Its end is read off its row (`updated_at`); `edit_get`'s
  `ms` is how long the job ran, so it cannot say this. A job whose end
  cannot be told is asked for, once.
- **Recovered by the two-minute cron** (`runReplySweep`, and the request
  sweep for a request's reply). An ended job with no record, a lapsed claim
  or a missed retry is asked again; past 15 minutes it is `failed`.
- **The page**:
  - a final answer with `replyState: "pending"` keeps it waiting, the live
    step reading *"Done — writing up what changed…"*;
  - a request is not closed while a part's reply, or its own, is pending;
  - a reload or another device reads the same record;
  - `failed` gets the fixed wording, as a technical failure.
- **Synchronous replies**, where a page still waits on its own connection:
  30 s a call and 45 s in all (were 12 and 20).
- **The cause of run 95's misses stays strongly inferred** from its timings.
  The Worker's logs were not read in this session, and nothing here depends
  on them.

**What the tests show, with supplied answers**, sync and queued where both
exist:
- **On run 95's own pages**:
  - Classes goes into the three menus that lack it; the two that have it and
    `/starter` are untouched, and Gallery is added nowhere.
  - Asked again, it is already done.
  - A scope of `/visit` changes only `/visit`.
  - `/starter` named is refused by name; an unknown page is said as such.
  - The footer's Instagram is already there.
  - A legal list is made on the five pages with a footer.
- **Through the edit route, on run 47's bakery** (four menus that differ,
  and a starter page with none):
  - a scoped addition, then the rest, then already done: nothing published;
    queued, no reserve, cost 0 and the job done; synchronously, the reading
    charged once;
  - a page with no menu, refused by name, its reserve refunded;
  - legal links: a list made only where no page in the scope has one, a later
    link only into the lists that exist, and the pages without one left so.
- **Through the add-on route**:
  - a menu placement put in every menu by code, each menu keeping its own
    items;
  - a placement on one page left to the writer, told the page and the place.
- **Through the request flow, R1's shape**:
  - the page's placement puts its link in every menu, so the link's part is
    already done: nothing published, its step not charged, its routing kept;
  - the part that needed it runs;
  - its own reply is a "nothing changed" fact, written from the facts.
- **The replies**:
  - **slow**: a reply held 13 s, longer than the 12 s that cut run 95's, is
    written in the background while the request's next part runs and
    finishes, and every read meanwhile is pending with no model call;
  - **provider failure**: a provider refusing every try gets three tries,
    30 s and 120 s apart, then `failed`; the page shows its plain wording, and
    the work and money are identical to a run whose reply was written;
  - **concurrent**: two simultaneous deliveries, a late duplicate and three
    reads make one model call;
  - **recovery after billing**: a consumer dying after the money was final
    leaves the cron to ask and the queue to write, with nothing re-run or
    re-charged; a writer evicted after its claim is not overtaken by a read
    while the claim holds, and the cron asks again after it lapses (written
    on the second try);
  - **the container**: its `/reply` under its own token; a pre-scoped build
    is refused, and with replies off nothing is asked;
  - **the window**: a job whose reply was never asked is asked for by the
    first read soon after it ends, and read three hours later gets its plain
    answer with nothing asked;
  - **the page**: it waits, then shows the parts' replies in order, the
    request's own once written, each once; a page opened later on another
    device shows the same.

**Not shown**: how a real model fills `add` or chooses a placement; how long
real replies take; whether 90 s per call is right. The reply log line keeps
each reply's `ms`, so real times can set it.

**Limits, kept separate** (the backlog), **both fixed since in the owner's
review round** (below):
- The page applies a part's result only when its reply is shown. So while a
  reply is retried the preview waits too: about ten minutes at worst (three
  tries), within the 15-minute horizon. Typical replies take seconds.
- While a reply is written, the Stop control still shows. Pressing it undoes
  nothing: a published job is refused as too late, an unpublished one has
  already ended, and the page goes back to waiting.

**Checks**:
- **Red check** on `9b543d8f` (the investigation, before any fix): every new
  or converted case fails, 26 cases in six files, and three files cannot load
  because the functions they test do not exist there. No unchanged case
  fails.
- **Sweeps**:
  - the fixes, 30 of 30 mutants killed. 26 at first; the four survivors were
    test gaps, each closed by a case and killed on the re-run;
  - 3 comment-only controls survived both runs;
  - the focused check's verdict, 5 of 5 killed, and its control survived;
  - the reply window (read off the job's row, found in review after the
    first push), 2 of 2 killed, and its control survived.
- **The full suite**: `9334 / 9334 / 0 / 0` at `1c914c81`, from 9,308 by 26
  new cases; unit CI there `9334 / 9330 / 0 / 4` (run 37180538871; CI skips
  four), and the site build green, every job (run 37180538878). With the
  window fix, `9335 / 9335 / 0 / 0`; at its commit, `6759c1a6`, unit CI
  `9335 / 9331 / 0 / 4` (run 37180946629) and the site build green (run
  37180946807).
- **The image**, predicted, not built: `882477e1bbbe8cbe` (main, running) →
  `66b30d542d98bc74` at the branch head, the window fix's commit after
  `1c914c81` (194 inputs).

**The next live steps** (each the owner's word; nothing is pressed from here):
1. Merge and deploy, then the free runtime press.
2. **The focused check**, one paid press, `rq-menu-link`: *"Put the Classes
   page in the menu on every page."* on `fold-lane-bakery`.
   - Expected: the three menus that lack Classes gain it; the two that have
     it and `/starter` stay as they are; nothing else changes; the reply is
     the model's own.
   - Estimate 3–9 credits (its budget is 10).
3. **Then R2–R5**, each once; R1 and `rq-canary` are done and not repeated.
   - Estimates: R2 10–25, R3 4–12, R4 3–7, R5 8–17.
   - One press each, since `rq-batch` always starts at R1.
   - **The batch has spent 25**: `rq-canary` 4, R1 21. With the focused
     check's 9 and R2–R5's 62 at their upper estimates, it would reach 96,
     within 100. *(Corrected in the review round: R2–R5's upper estimates
     are 25, 12, 7 and 17, which is 61, so 95.)*

## The owner's review of the fixes (2026-10-04, on the branch; not merged or deployed)

The owner, reviewing `d5f11aef`: *"The review confirms that the original
Classes menu failure is fixed, but address these remaining issues before
merging."* Four, each done; nothing merged, deployed, built or paid. The full
account, with every test and check, is
`docs/history/2026-10-04-review-round.md`.

1. **A footer addition accounts for every page it names**
   (`builder/site-nav.mjs`). The owner's reproduction (a legal Classes link
   on `/` only, then `pages: ["/", "/visit"]`) answered `satisfied` with
   nothing changed while `/visit` had no small print: named pages went
   through the rule for an addition nobody scoped (the list where the site
   has one). Now:
   - every named page is a target, and a named page whose footer lacks the
     list is given it;
   - a named page with no footer is refused by name (`no-footer-there`);
   - a target left without the entry is said (`not-written`, the last guard);
   - a home page named for a link to itself is told with the menu writer's
     own reason (`home-self`);
   - nothing is `satisfied` while a named page is unmet. With nothing else
     changed, the part is `failed`; with something changed, the part is
     `partial`. Either way, what needed it is not run;
   - an addition nobody scoped keeps its default.
2. **A retry is never claimed before its time** (`builder/site-reply.mjs`,
   `worker.js`). The owner reproduced an attempt-1 record due at 32 000
   claimed at 2 500 as attempt 2. One rule at the claim, `replyClaim`: a
   retry not yet due is skipped (2 s for the clocks), so an early or
   duplicate delivery spends no try and skips no wait; a holding claim is
   never taken; spent tries or the horizon fail it; a lost timed message is
   asked again by the cron after its time and the grace.
3. **The page applies the outcome at once and follows the reply on its own**
   (`public/edit-poll.js`, `public/chat.js`; the word from
   `builder/site-reply.mjs` and `worker.js`):
   - the preview, the page list, the undo offer, the credits and the send
     box move the moment the outcome arrives;
   - the reply's place on the thread is held by a line chosen from what the
     job did (`replyOutcome`, read from the reply's own facts): "Done" only
     where something changed, nothing was left undone and the answer's `ok`
     is true;
   - the reply is followed (`editReplyFollow`) and settles that message where
     it stands, once — or becomes the page's own sentence if it fails or
     never comes;
   - request parts the same way;
   - reloads and duplicate looks apply nothing and add nothing.
4. **R2–R5 in one press** (`rq-batch-r2`, `scripts/canary-batch.mjs`): the
   same driver from R2, never R1 or `rq-canary`. It keeps the order, one
   press at a time, the three stops and the threshold of 100. Its box is
   refused under 25, the batch's spend before it.

**Checks**: red check on `d5f11aef` (every new or converted case fails but
two, each explained; no unchanged case fails); sweeps 34 of 37, then the 3
survivors' gaps closed and 8 of 8, every comment-only control surviving; the
full suite `9381 / 9381 / 0 / 0`; unit CI `9381 / 9377 / 0 / 4` and the site
build green on `305c8b7c` (runs 37221787374, 37221787375). Supplied model
answers only. Two dated
Jobs-panel tests that the calendar broke on 2026-10-04 run on a fixed clock
(test only).

## Run 97, live (2026-10-04, deploy 2183)

The owner merged and deployed the reviewed fixes (deploy 2183, `e84b8e7e`,
image `386607152d4cb319`; run 96 confirmed the runtime) and approved one
focused press, `rq-menu-link`: *"Put the Classes page in the menu on every
page."* on `fold-lane-bakery`. The full account:
`docs/history/2026-10-04-deploy-2183.md` §7. **Live evidence**: real models,
real money, the real site.

- **F1, fixed live.** The router answered `addon`. The add-on step
  (`1eac152b…`, cost 0) handed the link to the menu step as an addition, and
  the menu step (`f666481a…`, cost 1) put *Classes* into the menus of
  `/order`, `/visit` and `/gallery`, leaving `/` and `/classes` (which had
  it) and `/starter` (no menu) as they were. Every canary site check passed,
  and the session's own read of the served pages agrees. 4 credits in all
  (routing 3, the edit 1; balance 91).
- **F2, not shown live for a part.** The page was handed the part's outcome
  with `replyState: "pending"` (`replyOutcome` `done`) 6 and 8 s after the job
  ended, and held the reply's place with *"Done — writing up what changed…"*.
  The canary ended the message then, because the page had closed the request,
  and judged the reply as composed. Since the review round, a held reply no
  longer keeps the page's request open, and the canary was not taught that.
  So **a gap in the instrument**. **Run 98 settled it** (the free read-one-job
  press, 2026-10-05): the reply was written by the model, in the background
  (*"✅ Classes is now in the menu on 3 of your pages; the other 2 already had
  it, next to the items that were already there."*). So F2's fix is shown live
  for a part's job; its settling in place on the page was not yet seen live
  then (run 99 saw it, below).
  The canary now waits for replies (`docs/history/2026-10-05-canary-reply-watch.md`).
- **Run 99 (R2–R5, 2026-10-05) carried both fixes through four more presses**,
  live and all passing (`docs/history/2026-10-05-batch-r2.md`): R2's Wholesale
  link went into every menu by the add-on (F1's placement half); every part's
  reply in R2–R5 was the model's own and on screen, three of them waited for
  after their requests ended (F2).
- **Also live in the run**: a request's own reply written in the background
  and served (R1's, about 35 s). It was R1's, 20 hours late, because a fresh
  browser picks up a site's earlier requests on open. It appended their
  replies under the message just sent (a finding of its own, in the backlog).
- **By the owner's rule, `rq-batch-r2` was not pressed.** The batch has spent
  29 (rq-canary 4, R1 21, the check 4).

## Closed (2026-10-05, the owner's review of run 99)

The owner: *"Run 99 passed review. … Close the completed batch findings."*
Closed, each in the backlog's index and in full
(`docs/history/2026-10-05-merge-and-closures.md`):
- **F1**, the menu link refused with `no-menu`: fixed live in run 97, and the
  add-on's own menu link by code in run 99's R2.
- **F2**, the parts with no model-written reply: written in the background
  and read by run 98; every part's reply in R2–R5 the model's own and on
  screen, three settling in place after their requests ended (run 99).
- **Both limits above**, fixed in the review round and deployed in 2183: the
  page applies a part's result at once and holds the reply's place; the Stop
  control is not shown over a reply being written.
- **The canary judging a part's reply before it was written** (run 97): the
  reply watch, run live as run 99 and merged to `main` with no deploy
  (`cd817fee`).

**Still open, kept separate**: earlier requests' replies placed under a new
message (a product bug, fixed on the branch since, not deployed:
`docs/history/2026-10-05-reply-placement.md`);
the new page's own menu label; a data edit's reply that cannot name the
change; the read-only lookup's `REPLY` wording; the preview's first `?v=1`.

## How the findings were checked (before the fixes)

- `test/request-findings.test.mjs`: 6 cases, 5 of them FOUND cases.
  - The menus after R1.
  - The add-on's one-page link directive.
  - The menu step's refusal, both ways.
  - R1's three results with facts and no reply.
  - Each way the reply call falls back, beside one that attaches a reply.
  - The reply call's 12 s timer: the real model call, given a short budget
    and a transport that never answers, is cut. The writer reads the cut as
    `send` after one call, while the same path answered in time is written.
    The Worker gives every reply call `REPLY_CALL_MS`.
- Each FOUND case asserted the behaviour as it was, so the fix that changes it
  flips the case. **Since the fixes, the file holds 12 cases asserting what
  replaced it** (*What is fixed*, above).
- Two sweeps of the product code the cases watch, every mutant caught, and
  all 4 comment-only controls survived:
  - 4 of 4: the frame's menu, the add-on's directive, a request part's facts,
    the reply's coverage;
  - 5 of 5: the call's ceiling raised, a cut read as the writer's deadline, a
    cut asked again, the call's timer ignoring the budget, the Worker's reply
    budget.
- The full suite: `9308 / 9308 / 0 / 0`, from 9,302 by the 6 new cases.
- The timings come from run 95's evidence (`ui.json`: each API answer's time
  in the page, and the canary's record of when each part changed) and its
  workflow log's timestamps; run 94's the same way.
