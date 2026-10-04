# Run 95's two findings, looked into (2026-10-04)

The owner, after run 95's R1 (`docs/history/2026-10-04-request-batch.md` §3):
*"yes look into both problems"*. Free: the code read, run 95's own records
(its evidence and its workflow log, with timestamps), and both reproduced with
the product's own functions on what run 95 recorded
(`test/fixtures/run95-r1.json`) and supplied model answers
(`test/request-findings.test.mjs`). No model was called and nothing was
spent. Nothing is changed in the product; the fixes below wait for the
owner's word.

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

With both, R1's message ends with the link on all six pages, and its menu part
done with nothing left to do. The tests to write first:
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

## How it was checked

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
- Each FOUND case asserts the behaviour as it is, so the fix that changes it
  flips the case.
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
