# Finishing Edit and Add-on work from one request: the plan (proposed, not built)

> **The order** (owner, 2026-10-03): *"Separately prepare the smallest concrete
> plan for completing Edit and Add-on operations automatically within the same
> user request, using the existing executors sequentially where dependencies
> or shared state require it. Trace how the router would represent both
> halves, how every operation retains its target and relevant answers, how new
> objects become available to dependent operations, how clarification resumes
> only unfinished work, and how publication, retries, partial failures and
> charges avoid duplication. The goal is that users do not have to resend the
> other half solely because it belongs to another route. Do not implement
> that cross-route execution change yet, introduce parallel writes, or
> redesign the architecture; finish with the exact proposed change and its
> tradeoffs for review."*
>
> **Status: a proposal for your review.** Nothing here is implemented. It
> builds on the mixed-work fixes on `claude/help-needed-ehlwlj` (unmerged):
> several parts put off per message, each named by its own words.

## 1. Where the other half goes today (traced)

A message reaches **one route**. Everything the route cannot make is carried
on its answer, in the customer's own words, and the customer is asked to send
it again:

| Who leaves it for later | The field on the answer | Its words kept? | What the customer reads |
|---|---|---|---|
| **The router**: a part no single answer can make with the rest (`alsoAsked`, a list on a site since this branch) | `deferred` | yes, checked against the message (`heldParts`) | *"I only did part of it this time. Say “…”, then “…”, and I'll do those next."* (`alsoTail` in `public/chat.js`) |
| **The look door**: an addition beside other edit work (W15, `lookHeld`) | `deferred` (with the router's) | yes | the same sentence |
| **The edit picker**: a part no lane here can make (`elsewhere`, this branch) | `deferred` (with the router's) | yes, checked (`readElsewhere`) | the same sentence |
| **A resumed question's request**: parts put off before the question, carried in (not in its message) | `putOff` | yes | the same sentence |
| **The add-on step**: a new list entry (`row`) or a menu link (`frame`) beside other kinds | `notAdded` (`row-alone`), `skipped: ["frame"]` | **no** — the add-on picker answers kinds only | *"I left out one row: … a step of its own"*, *"The new link … is a separate step"* |

Two chains already run **sequentially inside one request**, in the browser,
with the site's latch held across them (`escalatedEdit` in `public/chat.js`,
`EditPoll.escalateAction`, `EditPoll.handOver`):

- an edit whose step finds an addition it cannot make **alone** hands the
  same message to the add-on route (`siteAddon`, with the hand-over);
- an addition that is a lone menu link hands it to the menu step
  (`siteEdit`, `fromAddon`), which may not hand it back.

So the executors, the latch, the hand-over contract and the queue all already
support "one route, then another, for one request". What is missing is a
chain for a **finished** half followed by a **held** half.

## 2. The proposed change (the smallest that finishes both halves)

### 2.1 Each held part becomes a queued continuation, in order

When a route's answer carries parts left for later (`deferred`, `putOff`, and
the add-on's set-aside `row`/`frame` once they carry words, §2.4), the route
also writes **one continuation record** beside the site's live question, in
the same store and with the same owner check:

```
continue/<slug>.json  (one live record per site, like the question record)
{ v: 1, id, uid, slug, at,
  message,            // the original message, for checking each part's words
  context,            // the answers already given (readContext), as the question record keeps them
  attached,           // the attachments flag, as the question record keeps it
  parts: [ { words, status: "pending" | "running" | "done" | "failed" | "asked" | "skipped",
             job?, result? } ] }
```

and puts `continuation: { id, next }` on its answer (`next` = the first
pending part's words). Parts keep the order the customer wrote them in (their
position in `message`, which `heldParts` already computes).

### 2.2 The browser runs the next part through the existing routes

After it has shown the finished half's reply, the page (the same code path
that hops today) does, for `next`:

1. **routes it**: `POST /api/site/route` with `message = next` and
   `continuation = id`, so the router decides which route this part needs —
   the same model call and rules as any message, on the site as it now is;
2. **runs it** through `siteEdit` or `siteAddon`, with the latch still held
   and a hand-over carrying `continuation = id`;
3. repeats until no part is pending, one part asks, or one part fails (§2.6).

No new executor, no new route, no parallel write: each part is exactly the
request the customer would have sent next, run for them, one after another.

### 2.3 The Worker guards every continued part

On a post carrying `continuation = id`, the route (routing, edit and add-on
alike) refuses at no cost unless:

- the record is this owner's live record for this site, and not expired;
- the posted words are **the record's next pending part, exactly** (so a part
  can never smuggle in words of its own) and are found in the record's
  `message` (`wordsIn`, the same check `heldParts` makes);
- the part is moved `pending → running` by a conditional write before any
  model call (the job id is recorded on it), so a second post of the same part
  — a double click, a retry after a dropped connection, a second tab — finds
  it `running` or `done` and is answered from the record instead of run again.

The part's own route then runs it as usual and writes its outcome back to the
record (`done`, `failed`, `asked`, with the answer the reply was made from).

### 2.4 Every part keeps its target and the answers it needs

- **Its target is its words**, from the customer's message, through every hop:
  the router sees only those words; the picker scopes them (`scopes`, pages
  included); the steps run on them (`step.words`). Nothing done earlier is in
  them, so nothing done earlier can run again.
- **The answers already given ride with it** (`context` on the record, posted
  as the question record's are): each continued part's steps are shown the
  answers the picker names for them (`told`), exactly as a resumed question's
  are today.
- **The add-on picker names each kind's words** (new, small): a `scopes`
  list like the edit picker's, `[{ kind, words }]`, checked with `wordsIn`.
  This is what lets a set-aside `row` or `frame` become a continued part with
  its own words instead of a sentence asking the customer to say it again.

### 2.5 New objects are there for the parts that use them

Every route reads the site from the store when it starts — the pages
(`pages.json`), the stored look, the schema and its tables — and the router is
given the site's own page list (read from the store since the
information-limits batch 1, on this branch) and table names. So a part that runs **after** another part published sees what that
part made: a menu link continued after "add a gallery page" is routed with
`/gallery` among the pages and the menu step finds it; a function continued
after a table finds the table.

**Order is the only dependency rule**, and it stays a model judgement: one
sentence in the router's site instructions — *"When one part needs another to
exist first, answer the part that makes it, and hold back the part that uses
it"* — so the prerequisite is the half that runs first. No keyword rule, no
dependency graph.

### 2.6 Questions, failures, retries, publication and charges

- **A question in a continued part** is kept by the existing question
  machinery (`askReport`): its `request` is that part's remainder only, and
  its `held` list is **the record's parts still pending**, so the answer
  resumes only the unfinished part and the rest stay queued. When the resumed
  part finishes, the page continues with the next pending part. Done parts
  are `done` in the record and absent from every later request
  (`askRemainder` already excludes them).
- **A part that fails** is said with its own reason (its own reply), and **the
  chain stops**: every later part is marked `skipped` and named as left for
  later, as today. Whether a later part depended on the failed one cannot be
  known safely, so none runs after a failure.
- **Retries and reloads**: a part's job id is on the record; a page reloaded
  mid-part resumes watching that job (`EditPoll`'s existing resume) and then
  reads the record for the next pending part; nothing is posted twice (§2.3).
- **Publication**: each part publishes through its own route, once, as now —
  **one publish per part that changed something**, each a saved version that
  can be rolled back on its own. Merging two routes into one publish would
  need one publish spine across Edit and Add-on: a redesign, not proposed.
- **Charges**: each part pays its own routing call (1–2 credits, measured) and
  its own route's charges, exactly as if sent as its own message; the record's
  conditional `pending → running` write is what keeps any part from being
  charged twice. The queue's sequenced reserves and refunds are unchanged.

### 2.7 What the customer reads

Each part's reply is written as today (model-written from that part's facts,
or the page's composer as the fallback), one reply per part as it finishes.
The finished half's *"Say “…” and I'll do that next"* becomes a fact that the
part **is being done now** (`pending`, with its words), and the last reply
names anything left (asked, failed, skipped). No new reporting framework.

## 3. The exact files it would touch

| File | Change |
|---|---|
| `builder/site-ask.mjs` | the site tool's one dependency sentence (§2.5); `routeMessage` accepts a continuation part (the record's words) as the message |
| `builder/site-add.mjs` | the add-on picker's `scopes` (`[{ kind, words }]`, `wordsIn`-checked); set-aside `row`/`frame` keep their words |
| `builder/clarify.mjs` | the question record's `held` takes the continuation's pending parts |
| `builder/continue.mjs` (new, small) | `packContinue` / `readContinue` / `nextPart` / `claimPart` (the conditional write) / `settlePart`, mirroring the question record's helpers |
| `worker.js` | the edit and add-on routes write the record when an answer carries parts for later; the routing, edit and add-on routes check `continuation` (§2.3) and settle the part |
| `public/edit-poll.js`, `public/chat.js` | after a finished answer with `continuation.next`, route and run the next part with the latch held; resume from the record after a reload |
| tests | grouped cases through the real routes, sync and queued: an edit then an addition; an addition then a menu link to it; a question in the second half (only it resumes, the third part stays queued); a failure stops the chain and names the rest; a reload mid-part resumes without a second post; a duplicate post is answered from the record and charged nothing; charges per part equal the ledger; first Build untouched |

## 4. Tradeoffs, for your decision

| For | Against |
|---|---|
| The customer never resends a half because it belongs to another route | **Credits are spent on later parts without a second press** — today the customer chooses to send each; this needs your approval as a spending rule, and possibly a visible "doing this next" with a stop button |
| Reuses every executor, the latch, the hand-over and the question record; no parallel writes | **One routing call per continued part** (1–2 credits each): simpler and more reliable than teaching the first routing call to route every part |
| Each part is a normal, already-tested request, so its billing, queue, publish and reply rules are unchanged | **One publish and one saved version per part**, and a window between them where the site shows the first part only |
| A failure or a question stops cleanly, with every remaining part named and nothing run twice | **Time is the sum of the parts**; a long chain is several minutes on the queue |
| Ordering stays a model judgement (one sentence), with no keyword rules | A wrong order (a part that needed a later one) fails that part with its own reason; it does not corrupt anything, but it is not retried automatically |

**Not proposed**: running parts at the same time; one publish across both
routes; a dependency graph; letting the first routing call run several
routes' work. Each is a redesign, and only on your word.

**Before building it**, three decisions are yours: whether later parts may
spend without a second press (and whether with a stop control); whether one
reply per part is acceptable or the parts should be summarised at the end;
and whether a failure should stop the chain (proposed) or let clearly
independent parts continue.
