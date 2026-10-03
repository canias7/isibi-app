# Information limits on Edit and Add-on (audit, 2026-10-03)

> **The order** (owner, 2026-10-03, after the reply-cutoff correction passed
> review): *"audit all remaining information limits across Edit and Add-on
> only, tracing the full path from the browser's message input through
> request validation, router/model input, clarification questions and
> answers, saved history, operation selection, Worker/container handoffs,
> queued jobs, execution results, reply generation, and browser display …
> Our goal is natural conversation without arbitrary restrictions that lose
> meaning … This is audit-only: do not implement, merge, deploy, change
> Build, or expand into unrelated architecture work. Finish with one
> concrete implementation plan, and keep the subsequent real-model audit of
> correct route, operation, target, and clarification behavior listed as the
> next separate step."*
>
> **What this is.** A read of the code at `88406d05` (the branch
> `claude/help-needed-ehlwlj`), five read-only explorers whose findings I
> re-read in the code myself (the few I did not are marked "explorer's
> read"), and nine focused free probes (§13) with supplied model answers. Nothing implemented, merged or deployed; Build
> untouched; no model called, no paid run, no container rebuilt; one
> read-only select of stored reply lengths. Line numbers are at `88406d05`.

## In short

- **22 confirmed defects** (IL1–IL22: 7 shown by a probe, 15 by the code),
  **14 untested risks** (R1–R14), and the safeguards worth keeping, with
  their evidence (§7).
- **The ones that lose meaning without a word:**
  1. **Your words are cut at 2,000 characters, silently** (IL1). The page
     cuts them before sending; the thread shows the cut copy; no step, model
     or reply ever sees the rest, and nothing says so. Probe: 2,936 typed,
     2,000 sent.
  2. **A pending request can be dropped by the next message** (IL3). A side
     question while a question waits ("what's the difference?") either
     closes the question with the request dropped (probe) or replaces it
     (the router's `answered` has only yes and no). The customer is shown
     only the answer to their side question.
  3. **After a reload the page knows six of a site's pages** (IL9). The
     router can't see the rest, so "make the FAQ heading bigger" on a
     site's seventh page is routed as an addition (probe).
  4. **A change made beside a look change goes missing from the reply**
     (IL12, review #9's cause, found again under model replies). Through the
     real route, a menu change beside a layout move ships, its own account
     rides the answer (*"✅ Updated the menu on 2 pages…"*), and the reply
     facts say only *"Updated /."* (probe, sync and queued).
  5. **Steps drop work past their caps and say nothing** (IL13, IL14): a
     fifth look lane, the 21st row change, a fifth table's rules, a ninth
     picture change, an eleventh menu link, a ninth footer item.
  6. **An addition's declined kinds vanish on a partial success** (IL10,
     probe), and the routes cap nine lists before any reply sees them (IL11,
     MR9), with no count of what was cut.
  7. **A question is cut mid-sentence and its options clipped** (IL2):
     261 characters became 239 ending *"…open the…"*; a 66-character option
     became 42 with no mark, and choosing it sends the clipped words as the
     answer; a fifth option is dropped (probe).
  8. **Expiry and a full history abandon the request** (IL7, IL8): after 24
     hours the question and its request go, and a reload clears the card
     with no word; at 64 needed answers, going on means retyping.
- **What already works as asked:** the automatic re-ask thresholds (2
  repeats, 12 answers) stop only our own second call, never the customer
  (§6); every answer a request carries reaches the router, the picker, the
  steps and the add-on whole (§5); the stored chat history (40 messages) is
  display only and holds nothing unfinished work needs (§3.7); every reply
  fact reaches the reply model whole since `ddfe44f8`.
- **The reply bounds** (4,000 characters, 2,000 tokens) fit every large but
  ordinary outcome measured (§8: 1,406–2,748 characters of facts). But a
  reply past 4,000 is not asked again, the model is not told the bound, and
  **the page's fallback composer still caps its lists**, so facts do not
  survive a fallback (IL21, IL22). `covers` is the model's own claim, and
  nothing checks the wording against the facts (R1).
- **The plan** (§11): four batches in this order — the words and the page
  list whole; the pending request kept and named; every list whole or
  counted, and every outcome reported as it happened; the reply's bounds and
  a complete fallback. No new layer, no customer sentence in code, routing
  rules untouched except `answered` gaining its third value.
- **Next, separately** (§12): the real-model audit of route, operation,
  target and clarification behaviour. Not started; it needs your approval
  and a cost estimate.

## 1. How to read this

**What a limit does when it is reached:**

| Code | Meaning |
|---|---|
| REJECT-EXPLAINED | refused, with a sentence saying why; nothing changed |
| TRUNCATE-SILENT | cut, and the rest is lost without a word |
| DISCARD-SILENT | a whole item dropped without a word |
| SUMMARIZE | kept as a count or a shorter form that says it is shorter |
| STOP-RETRY | stops our own automatic retry; the customer can go on |
| EXPIRE | pending work removed after a time |
| SAFEGUARD | a resource bound whose reaching is reported |
| DISPLAY | affects only what the page draws, not what any model or step gets |

**Classes:** *Confirmed (probe)* — shown by a free run of the real code with
supplied answers (§13). *Confirmed (code)* — read in the code, with the
lines given; not driven. *Untested risk* — plausible from the code, not
shown. *Deliberate* — a limit already recorded and left by you. Severity:
**high** loses a request, completed work or a target without a word, or
misroutes; **medium** misstates a cause or drops a part in a way the
customer can see; **low** display, or not reachable through our own page.

## 2. The path, hop by hop

| Hop | Where |
|---|---|
| H1 The composer | `public/chat.js`: `siteSend` (12465), `siteAskReply` (12355), `siteAttachFiles` (4450), the composer's textarea (no `maxlength`) |
| H2 To the route | `siteRoute`'s body (`chat.js` 9141–9142: pages ≤24, tables ≤24); `POST /api/site/route` (`worker.js` 20434, a 2 MB cap at 20440) |
| H3 The router | `builder/site-ask.mjs`: `routeMessage` (2443), the digest (`digestLists` 934–941), the waiting request (`liveBlock` 1007–1020), `readEdit` (1870–1905), `readAsk` (2056) |
| H4 Questions and answers | `builder/clarify.mjs`: `packAsk` (206), `appendAnswer`, `askLive` (289), `clarifyTransport` (257); `worker.js`: the resume (20626–20700), `askReport` (6134–6181), the stale-answer sentences (6393); the question record in R2 |
| H5 The page dispatches | `chat.js`: the ask branch (9284–9302), `siteEdit` (9379), `siteAddon` (10222), `reactSend`'s revise body (11793–11797) |
| H6 Edit: selection | `worker.js` edit route (from 21597); `builder/site-lanes.mjs` `pickLanes`, `laneList` (1690–1711), `runTakeOff` (1026) |
| H7 Edit: steps | `builder/site-apply.mjs` (text, data), `site-rules.mjs`, `site-picture.mjs`, `site-nav.mjs`, `site-lanes.mjs` (look lanes), `site-tweak.mjs`, `page-gen.mjs` (page writer), `page-keep.mjs` |
| H8 Add-on | `worker.js` add-on route (from 26895): instruction (26991), designers (28262–28272), page writer (29296–29310), the answer (30745–30757) |
| H9 Queue and jobs | `worker.js`: `enqueueEditJob` (13836), the runner (1470s), `edit_finalize` (14104), `servedEditReply` (13386); `builder/edit-job.mjs`, `job-duration.mjs`, `job-retention.mjs` |
| H10 Results | `worker.js` 26716–26880: the multi-step merge and its catch-all |
| H11 The reply | `builder/site-reply.mjs`: `editReplyFacts` (326), `addonReplyFacts` (436), `readReply` (627), `writeReply` (658) |
| H12 The page draws it | `public/edit-poll.js` `modelReply` (`MODEL_REPLY_MAX` 4,000 at 209); the fallback composer in `chat.js` (`editReply` 11334, `partialSaid` 11229, `alsoTail` 11018, `problemNote` 11032, `addonReplyText` 10806); storage (`sitesSave` 4561) |

## 3. The limits you named, traced

### 3.1 The 2,000-character request

- **Where:** `chat.js` `siteSend` 12465 and `siteAskReply` 12355
  (`.trim().slice(0, 2000)`); `worker.js` 21817 (the edit route's
  instruction) and 26991 (the add-on's); `site-ask.mjs` `routeMessage` 1036
  (`slice(0, MAX_MESSAGE)`, noted as `message-cut` in the trace at 2497,
  never to the customer); every step's request repeats the cut (for example
  `site-apply.mjs` `textRequest`, `site-lanes.mjs` 1665). The same 2,000
  bounds a held part (`heldList`, site-ask.mjs 1690), a stored request
  (`packAsk` refuses longer), and the resumable job record
  (`edit-poll.js` `ASK_MAX` 331; `rememberJob` cuts at 394).
- **From whom to whom:** the customer's typed words → cut in the page →
  every later hop sees at most 2,000.
- **At the limit:** TRUNCATE-SILENT. **Probe P1:** 2,936 characters typed;
  2,000 sent, and the thread shows the cut copy as what they said; no
  notice. The server never refuses, because our page never sends more; a
  longer message from another client is cut silently at three server hops.
- **Reaches the model?** Only the first 2,000 characters. The rest reaches
  no model, step or reply, and is not named as left for later.
- **Tests:** none says the cut is told. `live-clarify-browser.test.mjs`:487
  refuses an over-bound resume value; `packAsk`'s refusal is covered in
  `live-clarify-contract.test.mjs`.
- **Evidence for 2,000:** none recorded for the number itself; it is the
  bound everything downstream was written to. Each extra 1,000 characters
  is roughly 280 tokens more in each call that carries the message (the
  router, the picker, each step, the reply).
- **Verdict:** **IL1, confirmed (probe), high.** The silence is the defect;
  the number is yours.

### 3.2 The 500-character clarification answer

- **Where:** `site-ask.mjs` `MAX_ANSWER_CHARS` 2130; `readContext` (2145)
  refuses an answer list holding a longer one; the route refuses a longer
  answer at the resume (`worker.js` 20651–20657, `answer-too-long`: 422, cost
  0, the question still waiting).
- **At the limit:** REJECT-EXPLAINED (*"That answer is longer than I can keep
  beside your request. Your request is still waiting — answer the question
  in a sentence or two…"*). The page cuts an answer at 2,000 first
  (`siteAskReply`), so 501–2,000 is refused whole, and above 2,000 the cut
  copy is refused.
- **Reaches the model?** Every kept answer, whole, to every model that needs
  it (§5).
- **Tests:** `live-clarify-history`, `live-clarify-route`,
  `model-replies-routes`.
- **Evidence:** 64 answers × (240 + 500) is about 47,000 characters in the
  router's and the picker's input at worst (N60).
- **Verdict:** works as explained. Keep; the number is yours (an answer that
  quotes a long heading can pass 500).

### 3.3 The 240-character question, 48-character options and four options

- **Where:** `site-ask.mjs` `MAX_QUESTION_CHARS` 90, `MAX_OPTION_CHARS` 93,
  `MAX_OPTIONS` 88 (`MIN_OPTIONS` 2); `clipQuestion`, `clipOption` and
  `readAsk` (1987–2072). The model is told "two short sentences", "a few
  words", "up to four", and not the numbers (the comment: *"a cap the model
  is told about is not one"*).
- **At the limit:** TRUNCATE-SILENT and DISCARD-SILENT. **Probe P5:** a
  261-character question came back 239 characters ending *"…when they open
  the…"* (the deciding *"Visit page on a phone?"* gone); five options came
  back four (the fifth, *"The one on the home page instead"*, dropped); a
  66-character option came back as the 42 characters *"The order band
  that sits under the opening"*, with no mark.
- **Stored and passed on:** the clipped text is what is stored, shown, and
  read by every later model (*"They were asked: …"* in `liveBlock`, and the
  `q` of every answer). **Choosing a clipped option sends the clipped words
  as the answer.**
- **Tests:** `site-ask.test.mjs`:591 and :1082 assert the clipping.
- **Verdict:** **IL2, confirmed (probe), medium.**

### 3.4 The 64-answer history

- **Where:** `site-ask.mjs` `MAX_HISTORY` 2115; `appendAnswer` keeps every
  answer still needed and lets go of `handled` ones; at 64 still needed the
  route refuses (`worker.js` 20659–20664, `answers-full`).
- **At the limit:** REJECT-EXPLAINED (*"…press Cancel on the question and
  send what's left of it as a new message"*). Nothing guessed, nothing
  charged, the question still waiting.
- **Reaches the model?** All of it (§5).
- **Tests:** `live-clarify-history`, `live-clarify-limits`,
  `model-replies-routes`.
- **Verdict:** deliberate (N59: 64 is ours, yours to move; reaching it takes
  52 rounds past where our own re-asking stops). **The gap is the handover**:
  going on means retyping the request and losing every answer — **IL8,
  confirmed (code), medium.**

### 3.5 The 12-answer threshold and the repeated-question threshold

- **Where:** `MAX_ASKED` 12 (site-ask.mjs 2100), `MAX_SAME_ASK` 2 (2127);
  `clarifyTransport` (clarify.mjs 257–268). A model reply that asks what
  was already answered is sent back once with that answer in front of it.
  Once that question has been answered twice, or the request carries 12
  answers, the reply is returned as it came, question and all, and the step
  asks it and does nothing proposed beside it. The router's own repeat
  (`again`) is kept under a note naming the answer that did not settle it
  (`repeatNote`), and the reply names earlier answers at the limit
  (`repeatNoteFacts`, site-reply.mjs 575).
- **At the limit:** STOP-RETRY only. The customer can go on answering (to
  64); nothing is guessed; nothing done is repeated, because a step that
  asks has done nothing; the request stays waiting.
- **Tests:** `live-clarify-contract.test.mjs`:772;
  `live-clarify-limits.test.mjs`:77 and :390.
- **Verdict:** correct: a limit on our retries, not on the conversation.

### 3.6 The 24-hour question expiry

- **Where:** `clarify.mjs` `ASK_TTL_MS` 119 and `askLive` 293 (`expired`);
  the answer's sentence at `worker.js` 6393–6394; the page's `siteAskCheck`
  clears a card the server no longer has (`siteAskClear`).
- **At the limit:** EXPIRE. The request and its answers go with the
  question. An answer after expiry is told *"That question has expired, so I
  didn't act on your reply. Tell me what you'd like and I'll take it from
  there."* — the request is neither named nor put back in the box. A reload
  after expiry clears the card with no word at all.
- **Evidence for 24 hours:** only the comment's reason (*"A day: an answer
  the next morning still counts"*); nothing measured. The real reason for
  some expiry stands: the request was about the site as it was.
- **Tests:** `live-clarify-contract.test.mjs`:127,
  `live-clarify-route.test.mjs`:260; none for the silent clearing.
- **Verdict:** **IL7, confirmed (code), high.**

### 3.7 The 40-message chat history in the browser

- **Where:** `chat.js` `sitesSave` 4566 (`msgs.slice(-40)`), with 20 sites
  (4562), six pages' markup (4565) and eight saved versions (4573), all in
  the browser's own storage.
- **Who reads it:** only the thread, after a reload. **No model is sent this
  history** (§5): the router gets the message, the page and table lists, and
  the waiting request with its answers from the server's own record.
- **At the limit:** DISPLAY. Messages past the last 40 vanish from the
  thread after a reload; nothing unfinished work needs lives only there.
- **The exception:** the six-page cap in the same function does reach the
  router — §4 H1 and **IL9**.
- **Verdict:** display only; keep.

### 3.8 The lists of parts left for later

- **Where:** `MAX_HELD` 4 (site-ask.mjs 1671), `heldList` (1684),
  `heldParts` (1712); the edit route refuses an unreadable list
  (`worker.js` 21943, `route/held-unread`: 503, cost 0, *"Send the changes
  one at a time"*, the same sentence for every cause); `putOff` is read as
  `heldList(...) || []` (21858); `packAsk` refuses more than 4;
  `askReport`'s `clarify-unkept` (6176); `edit-poll.js` `heldWire` (364)
  passes an over-bound list on unread; the reply passes every part
  (`partsOf`, uncut since `ddfe44f8`); the fallback's `alsoTail`
  (`chat.js` 11018).
- **At the limit:**
  - a fifth part held back in one message: REJECT-EXPLAINED, one sentence
    whatever the cause;
  - a question kept beside parts: earlier (≤4) plus this turn's (≤4) can
    pass 4, and the question cannot be kept. **Probe P2:** 503
    `clarify-unkept`, *"…couldn't keep track of the question just now…"*.
    What was left goes back in the box, but the cause is fixed and told as
    momentary — **IL6, confirmed (probe), medium**;
  - `putOff` over 4 is dropped silently, but our page cannot send one (a
    stored question never holds more than 4) — low;
  - the fallback composer drops **every** part when there are more than 4
    (`heldList` answers `null`, read as none) and cuts each at 200
    characters — part of **IL21**.
- **Evidence for 4:** none beyond a protocol bound. Each part must be found
  in the message, so the message's own bound already bounds them.
- **Tests:** `handover-batch2.test.mjs`:207 and :352;
  `edit-op-scope.test.mjs`:488 and :958; `live-clarify-continue.test.mjs`:109
  and :598; none for more than 4 across a question.

### 3.9 The routes' own list caps (MR9)

Every slice below is applied in `worker.js` before the reply or the page
sees the answer; none keeps a count of what it cut, except `keepRefusal`.

| Field | Cap | Where | What is lost |
|---|---|---|---|
| `notAdded` | 6 | 27405, 27615, 28966, 30745 | additions left out, past the sixth |
| `problems` | 4 | 26007, 26017–18, 26060, 26086, 26188, 29488, 30945 | the page check's findings |
| `words`, `ownPhotos` | 6 each | 30757 and the next line | words and own photographs placed |
| `keptParts`, `unseenParts` | 6 each | 26005–06, 26202–03; the merge caps the union at 6 again (26834–37) | sections left alone; the message names 3 (25996) |
| `reordered`, `ignored` | 4 each | 26191, 26187 | other pages showing the old order; pages left alone |
| `changed` | 8 | 24403 | new wordings (the count `applied` stays whole) |
| `staleTel` | 4 | 24406 | stale Call and email links |
| `dead` | 4 | 26534 | the verify catch's findings |
| `contentBlocked`, `contentUnchecked` | 6 | 10194, 10202 | counted: 3 named, then "and N more" (`page-keep.mjs` 623) |

- **Tests:** none for the caps; `edit-page-protect.test.mjs`:913 checks
  `keptParts` is there.
- **Evidence:** the stored reply has room: 315 stored job replies, the
  largest 27,961 characters, against the 200,000-character store bound
  (read-only, §13).
- **Verdict:** **IL11, confirmed (code), high.**

## 4. Every other limit, hop by hop

### H1 The composer and the browser's storage

| Limit | Where | At the limit | Class |
|---|---|---|---|
| message 2,000; answer 2,000 | `siteSend` 12465, `siteAskReply` 12355 | TRUNCATE-SILENT | IL1 |
| files: 3 per message | `siteAttachFiles` 4450–4465 (`slice(0, 3 - …)`) | extras DISCARD-SILENT; a chip refused as too large still counts toward the 3 (explorer's read) | low |
| files on an answer: 3, the answer's own first | 9236 (`sendImgs.concat(keptImgs).slice(0, 3)`) | the original message's files dropped silently | **IL5**, code, medium |
| pages stored: 6, refetched only when ≤1 is stored | `sitesSave` 4565; `siteRoutesFetch` call at 7644 | after a reload the router is told six pages (P6) | **IL9**, probe, high |
| sites 20, messages 40, versions 8 (markup 400,000; a version's design 4,000 and pages 300,000) | `sitesSave` 4562–4576 | DISPLAY and restore only | keep |
| an in-flight job remembered 1 hour | `edit-poll.js` 463 | after an hour the page forgets the job; its ending is never shown | R4 |
| the poll gives up at 52.5 minutes | `edit-poll.js` `POLL_GIVE_UP_MS` 259 | jobs may run 50 minutes; a reload in the last 7.5 minutes still resumes | R4 |
| no Stop for a queued edit | `cancelEditJob` (10105) has no caller | the customer cannot stop a running edit | **IL20**, code, low |

### H2 The route reads the request

| Limit | Where | At the limit | Class |
|---|---|---|---|
| body 2 MB on `/api/site/route` | `worker.js` 20440 | REJECT (413) | SAFEGUARD |
| no body cap on the edit, add-on or question routes | — | an oversize body is read whole | R7 |
| message cut at 2,000 by the router too | `site-ask.mjs` 1036, traced as `message-cut` (2497) | TRUNCATE-SILENT | IL1 |
| answers: ≤64, `q` ≤240, `a` ≤500, else the whole list refused | `readContext` 2145; edit route 21946 (`route/context-unread`, 503, cost 0) | REJECT-EXPLAINED (our page never sends one) | keep |
| `askRound` not a positive integer → round 1, no upper bound | 21849 | harmless | — |
| the routing cost outside 0–1,000 dropped | 6211 | the reply omits it | low |

### H3 The router

| Limit | Where | At the limit | Class |
|---|---|---|---|
| the digest's pages ≤24, tables ≤24 | `digestLists` 938–939 | the router cannot name page 25 onward; `readEdit` still checks the full sent list (P7: page 27 of 30 → edit) | R12 |
| output 700 tokens | `ASK_MAX_TOKENS` 65 | SAFEGUARD; set 2026-08-08, and every live routing run since has used it | keep |
| a page not in the sent list → addition | `readEdit` 1870–1905, `FALLBACK_WITH_SITE` (117) | with six stored pages, a real seventh page's edit becomes an addition (P6) | **IL9** |
| `answered` is only yes or no | schema 870–877, `liveBlock` 1007–1020 | a side question while a request waits supersedes it; the request is dropped without a word | **IL3**, code |
| `answered: true` beside intent `ask` | route 20626–20690; page 9288–9302 | the question is closed and the page shows only the answer; the waiting request is never run or named (P3) | **IL3**, probe, high |
| question 240, options 48, four options | `readAsk` 2056 | TRUNCATE/DISCARD-SILENT (P5) | **IL2** |
| `MAX_CLARIFY` 3 | site-ask.mjs 84 | Build only — out of scope | — |

### H4 Questions and answers

| Limit | Where | At the limit | Class |
|---|---|---|---|
| a stored question: request ≤2,000, held ≤4, answers as H2, note ≤300 | `packAsk` 206–231 | `clarify-unkept` (503), what was left back in the box | IL6 when the held parts pass 4 |
| expiry 24 hours | `ASK_TTL_MS` 119 | EXPIRE without naming the request | **IL7** |
| answers 64 / 500 characters | §3.2, §3.4 | REJECT-EXPLAINED; retyping to go on | **IL8** |
| automatic re-ask 2 / 12 | §3.5 | STOP-RETRY | keep |
| a question with no request left | `askReport` 6159 (`clarify-mixed`) | REJECT-EXPLAINED (*resend that part*) | keep |
| a step's question on three endings | `editStopped` (13441; called at 26370, 26432, 26508), the publish failure (26582–95), the stylesheet check's catch (26522) | those answers carry no `partial` or `ask`, so a question a step asked beside others is neither kept nor shown, and the other steps' refusals leave that reply too | **IL17**, code, medium |

### H5 The page sends the work

| Limit | Where | At the limit | Class |
|---|---|---|---|
| a resumed request sent to the full rewrite | `reactSend` revise body 11793–11797 | carries no answers, earlier parts or round: they are lost | **IL4**, code, medium |
| files on an addition | `siteAddon` 10222–10251 sends `attached: true` only; the add-on route reads it only for the question record (27002); its page writer is handed `[]` (29305) | the files reach no step, silently | **IL19**, code, high |
| files on an edit | `worker.js` 24192 (`slice(0, 3)`), `site-logo.mjs` 180 uses the first | only the logo step sees them; a picture step never does | **IL19** |

### H6 Edit: choosing the operations

| Limit | Where | At the limit | Class |
|---|---|---|---|
| the picker's message 2,000; its site list ≤24 pages | `site-lanes.mjs` 1665; the digest | as H1, H3 | IL1, R12 |
| picker output 800 tokens, `stop_reason` not checked | `LANE_PICK_MAX_TOKENS` 139; `pickLanes` | a cut answer is read as whatever it holds | R2 |
| at most 4 lanes | `MAX_LANES` 245; `laneList` 1690–1711 (break at 1702); schema `maxItems` | a fifth lane is not run, not in `partial`, not left for later, never told | **IL13**, code, high |
| page paths ≤120 characters | 1625, 1949 | cut silently; real paths are shorter | low |
| take-off: 400 tokens; a cut answer | `runTakeOff` 1026–1042 | said as *"The editor is busy — try again in a moment."* (`worker.js` 24663) | **IL15** |
| take-off: names 80 characters; unknown names told 3 at a time, 40 characters | 988, 1066, 1079 | SUMMARIZE | low |

### H7 Edit: the steps

| Step | Limits (where) | At the limit | Class |
|---|---|---|---|
| text | 1,500 tokens (`TEXT_MAX_TOKENS` 84); ≤600 pieces of wording (`MAX_TEXT_ITEMS` 104; 356); a replacement ≤400 characters (`MAX_TEXT_CHARS` 107) and free of `"`, `'`, `` ` ``, braces, angle brackets and backslashes (307) | over 600: climbs to the page rung (designed). A replacement that breaks either rule is dropped; when all are, the customer is told *"I couldn't find that wording on your site. Tell me the exact words…"* (`edit-failure.mjs` 255; `worker.js` 24369) — a wrong cause. The model is told "no quotes" (130–136), so *"We're open late"* must be reworded or is dropped | **IL16**, code, medium |
| data | 1,200 tokens (`DATA_MAX_TOKENS` 439); ≤60 rows a table shown (`MAX_DATA_ROWS` 441; 552); ≤20 changes (`MAX_DATA_OPS` 443; 693, 706); `failed` as a count (851) | rows past 60 cannot be named: *"I couldn't match that…"*, charged on the synchronous path (23452; refunded on the job path, run 77). The 21st change onward is dropped silently | **IL14**, code, high |
| rules | 1,400 tokens (`RULES_MAX_TOKENS` 59); ≤4 tables (`MAX_RULE_TABLES` 62; 395); unique and once-per-user ≤6 columns; a row limit ≤10,000,000 | a fifth table is dropped, not listed in `refused`; the clamps are silent | **IL14** |
| picture | 1,200 tokens (`PICTURE_MAX_TOKENS` 57); ≤60 photographs seen (`MAX_SLOTS` 60; 144, 184); ≤60 uploads shown (854); ≤8 changes (`MAX_PICTURE_OPS` 63; 997–1051); descriptions 240 (`MAX_DESCRIBE` 878, applied at 1039) | photographs past 60 cannot be found; the ninth change onward is dropped silently | **IL14** |
| nav | 1,200 tokens (`NAV_MAX_TOKENS` 61); ≤10 menu links (`MAX_NAV_ITEMS` 64; 1157); footer lists ≤8 (`MAX_LIST_ITEMS` 2183; 1076); labels 40 (`MAX_LABEL` 67); contact fields 160 (`MAX_CONTACT_CHARS` 73; 1099); ≤12 page-link changes (`MAX_LINK_CHANGES` 2408; 1130); ≤40 link groups shown (`MAX_LINK_LINES` 2405; 745) | the eleventh link is dropped silently (an addition past it does say the menu is full, 1582); footer items past 8 are cut; `dropped` reaches the answer as a count only (`worker.js` 23984) | **IL14** |
| look lanes | `min(16,000, field cap / 3 × 1.25)` tokens, at least 1,000 (`LANE_EDIT_MAX_TOKENS` 148, `CHARS_PER_TOKEN` 180, `TOKEN_SLACK` 181, `LANE_MIN_TOKENS` 183; `tokensForChars` 218); landmarks ≤40 (`MAX_LANDMARK_ROWS` 2232); the theme note 14,000 with a marked cut (`MAX_THEME_NOTE` 2190); stylesheet output over 60,000 cut at a rule and told (`site-freecss.mjs` `MAX_CSS` 48; 318–330) | a cut lane answer is said as *"The editor is busy — try again in a moment."* (`worker.js` 24738), and every lane already run is set aside with it | **IL15**, code, medium |
| quick writer (`tweak`) | 16,000 tokens (`TWEAK_MAX_TOKENS` 74); pages over 48,000 characters (`MAX_TWEAK_CHARS` 94) → the page writer (711) | designed hand-on | keep |
| page writer | 30,000 tokens (`page-gen.mjs` `SITE_PAGES_MAX_TOKENS` 4333); a page returned over 48,000 characters (`MAX_PAGE_CHARS` 807); the target page shown whole to 90,000 (`MAX_PRIOR_CHARS` 2671); components over 12,000 each or 36,000 together withheld and named (`MAX_PART_CHARS`, `MAX_PARTS_CHARS` 2445–2446; `keptParts`); the stylesheet cut at 16,000, told to the model (`MAX_STYLE_CHARS` 2580) | a cut answer or an over-long page is said as *"The page writer didn't send the page back… Try again in a moment."* (`edit-failure.mjs` 269; `worker.js` 26017) — a size, told as a moment | **IL15** |
| page writer's clock | `worker.js` 25735 passes `null` (the add-on passes the job's budget, 29305) | bounded by the call's own timeout, not by the job's remaining time | R10 |
| `keepCheck` | 1,024 tokens (`page-keep.mjs` `KEEP_MAX_TOKENS` 50) | fails closed with a 503 | SAFEGUARD |

Steps that read a cut answer as one: only `runTakeOff` (1038), `runLane`
(2312) and one add-on call (`site-add.mjs` 2209) check `stop_reason`. On the
other steps a cut answer is read for whatever it holds — on xAI possibly no
tool answer at all, which the data, nav and rules steps report as a
no-match (R2; the explorers' read, not driven).

### H8 Add-on

| Limit | Where | At the limit | Class |
|---|---|---|---|
| instruction 2,000 | 26991 | TRUNCATE-SILENT | IL1 |
| a designer that declines | pushed to `aDeclined` (28270), read only when every kind declined (28528) | on a partial success the declined kinds are in no answer (P4) | **IL10**, probe, high |
| a model that cannot be reached | `aDown` 27338–27346 | the model-down sentence (billing and timeout told apart) | keep |
| the page writer's files | `[]` at 29305 | IL19 | **IL19** |
| `notAdded`, `words`, `ownPhotos`, `problems` | §3.9 | MR9 | **IL11** |
| the site note designers read | explorer's read: caps that hide a large site's facts | not driven | R8 |

### H9 The queue and the job

| Limit | Value, where | Reached | Class |
|---|---|---|---|
| an edit job on the Worker | 840 s (`edit-job.mjs` 65); the stylesheet correction skipped under 60 s left (246) | `editStopped` *"That took longer than the time we allow…"*, reserve refunded | SAFEGUARD |
| a job in the site's container | `JOB_MAX_MS` 50 min (`job-duration.mjs` 72) | stopped at the next gate, refunded | SAFEGUARD |
| a queued job not taken | `STALE_QUEUED_S` 600 (411): sent again once, then failed | told | SAFEGUARD |
| the site busy with another job | 45 deferrals (329) × `SITE_BUSY_DEFER_S` (355: 50 min / 45 ≈ 67 s) | failed, told | SAFEGUARD |
| the container cannot take it | `FIRE_RETRY_MAX` 3 (1113) × `JOB_FIRE_MS` 90 s (1042) | `no-container`, 503, told (`worker.js` 1470–1479) | SAFEGUARD |
| the stored reply | 200,000 characters (`worker.js` 14105) | if ever reached, stored JSON would no longer parse; measured: largest 27,961 of 315 | R11 |
| retention | `JOB_RETENTION_MS` 7 days (`job-retention.mjs` 51) | the record goes | keep |
| a reply whose cost the ledger has not settled | `servedEditReply` 13386–13396 deletes `cost` | the reply says nothing about money for that edit | **IL18**, code, medium |
| a lost lease; a reused retry key | explorers' reads | the lost lease is noticed only at a gate; a reused key returns the old (possibly failed) job | R5, R6 |

### H10 The merge of several steps

- A success of several steps is labelled `look` (`worker.js` 26720), and
  the catch-all (26863–26868) copies each key the merge does not model from
  the **first** step that has it — so the later steps' `msg`, `applied`,
  `refused`, `staleTel`, `failed`, `problems`, `reordered` and `ignored` are
  dropped.
- `editReplyFacts`' look branch (site-reply.mjs 375–393) reads none of
  `msg`, `staleTel`, `reordered`, `ignored` or `applied` — so even the first
  step's own account, which survives the merge, never reaches the reply
  model. Page operations do (`pageOps`).
- **Probe P9** (the real edit route, supplied answers, sync and queued): the
  menu change and the layout move both ship; the answer's `msg` is *"✅
  Updated the menu on 2 pages: Today's bake · The starter · Visit."*; the
  reply facts are `["c1: Updated /."]`. The old screen for the same answer
  is *"✅ Updated the look."* (asserted in `edit-removal-door.test.mjs`).
- **IL12, confirmed (probe), high.** This is review #9's cause, which you
  kept separate; the model replies covered the page-operation half of it
  and not this half.
- Also read (explorer, not driven): after a stylesheet correction round,
  the first publish's translation charge is not in `cost` (26503, 26755),
  though it is in `usage` (R13).

## 5. Stored history versus what the models are sent

| What | Kept where, and its bound | Sent to | Bound when sent |
|---|---|---|---|
| the chat thread | the browser, 40 messages a site | **no model** | — |
| the waiting request | the R2 question record, ≤2,000 | the router (`liveBlock`); the resumed step, as its instruction; the reply model (`replyContext`) | whole |
| answers given | the record, ≤64 (q ≤240, a ≤500) | the router: all; the picker: all not `handled`; each step: those the picker named plus every unnamed one (`toldOf`, `worker.js` 22978–83); the add-on: all; the reply model: all | whole |
| parts left for later | the record, ≤4 | the router (copied back), the route (taken out of the message), the reply (facts) | whole; the fallback drops them past 4 |
| the page list | the browser: **6 after a reload** | the router's digest (≤24); `readEdit` checks the full sent list | the stored six — IL9 |
| table names | the browser, ≤24; the route reads the owner's own when none were sent (Lane 1d) | the router | ≤24 |
| an in-flight job | the browser's record (1 hour, request ≤2,000); `edit_jobs` (7 days) | the poll | — |
| a finished job's answer | `edit_jobs`, ≤200,000 | the page, the reply model | whole |
| what the last change did | the thread and `edit_jobs` | **no model** | — |

The last row matters for a natural follow-up: "put it back", "do the same on
the other page" or "why didn't the menu change?" reach the router with no
account of the previous turn, so they work only when the customer restates
what they mean, or the reply told them the exact words to send (the undo
facts do). This is a design gap, not a cut; it is in the plan as your
decision (§11, step 5).

## 6. Automatic retries versus the customer going on

| What retries or stops | Its bound | When reached | Can the customer go on? |
|---|---|---|---|
| the router asking what it was told | 1 extra call; stops at 2 repeats or 12 answers | the customer is asked, with a note naming the earlier answer | yes, to 64 answers |
| a step asking what it was told (`clarifyTransport`) | the same | the step asks and does nothing beside it | yes |
| the reply writer | 2 calls, the second only for a fact left out | an over-long or unreadable reply is not asked again: the page's fallback | yes |
| the container taking a job | 3 tries × 90 s | `no-container`, told | yes, by sending again |
| a queued job not taken | re-sent once after 600 s | failed, told | yes |
| a busy site | 45 waits ≈ 50 min | failed, told | yes |
| the customer's own answers | 64 still needed | refused, told; going on means Cancel and retyping (IL8) | only by retyping |
| the question's life | 24 hours | the request is dropped; not named; a reload says nothing (IL7) | only by retyping |

No threshold forces a guess, and none repeats completed work: a step that
asks has done nothing, and an answer resumes only what was left
(`askRemainder`). Expiry and a full history are the two places where the
pending request is abandoned without being handed back.

## 7. Safeguards to keep, with their evidence

| Safeguard | Value | Evidence | When reached |
|---|---|---|---|
| the route's body | 2 MB (`worker.js` 20440) | a public JSON route | refused before reading |
| a quick model call | 240 s (`QUICK_CALL_MS` 3996) | the egress hangs up an idle connection at about 270 s | the call fails as ours |
| a quick streamed call | 480 s (`QUICK_STREAM_MS` 4035) | run 40: a wordmark died at 240 s; stays under the 840 s job | as above |
| a builder call | 600 s (`BUILDER_CALL_MS`, `build-call.mjs` 36) | composes with the job's clock through `capMs` | as above |
| an edit job on the Worker | 840 s | run 33 measured the teardown at 4.3 s; an addition needs a 390 s page call and a 157 s compile (run 32) | `editStopped`, refunded |
| a container job | 50 min | bounded by `edit_handoff`'s 3,600 s (a live Postgres function), 450 s spare | stopped at a gate, refunded |
| the store's question record | request 2,000, answers 64 × (240 + 500) | ≈47,000 characters at most per call (N60) | refused, explained |
| model output budgets | router 700; picker 800; text 1,500; data 1,200; rules 1,400; picture and nav 1,200; take-off 400; lanes ≤16,000; quick writer 16,000; page writer 30,000; keep check 1,024; reply 2,000 | the router's 700 has served every live routing run since 2026-08-08 | a cut answer: see IL15 and R2 |
| leases and deferrals | 90/30/60 s leases; 45 × 67 s; 3 × 90 s fires | the measured job lengths and the platform's limits recorded in `edit-job.mjs` | failed and told |
| a stored reply | 200,000 characters | largest measured 27,961 (315 jobs) | R11 |
| money | `edit_reserve` refuses a charge the balance cannot cover | the ledger | refused before any work |

Keep every row. What the plan changes is what happens **after** some are
reached: a cut answer is said as what it is (IL15), and nothing past a
bound is dropped without a word.

## 8. The reply's bounds, the fallback, and whether coverage is honest

- **The bounds:** `REPLY_MAX_CHARS` 4,000 (site-reply.mjs 73; the page reads
  the same, `MODEL_REPLY_MAX`); `REPLY_MAX_TOKENS` 2,000 (76); 12 s a call,
  20 s in all.
- **Measured** (probe P8, no model): large but ordinary outcomes give 14 to
  40 facts, 1,406 to 2,748 characters of facts, about 1,457 to 1,851 tokens
  in; listing every id in `covers` takes about 66 to 170 tokens. A reply
  naming every fact in plain words runs about as long as the facts, so these
  fit. Facts pass 4,000 characters only when lists are long — for example 20
  rows taken off with six fields each, or the MR9 lists once lifted.
- **At the bounds** (`readReply` 627–639, `writeReply` 658–690):
  - a reply over 4,000 characters is refused as unreadable and **not asked
    again** (only a reply that left a fact out gets a second call); the page
    then composes its own;
  - an answer cut at 2,000 tokens is unreadable, with the same result;
  - **the model is not told the 4,000** (`REPLY_TOOL`: *"As long as that
    takes and no longer"*).
  — **IL22, confirmed (code), medium.**
- **The fallback drops facts.** The page's composer still caps: `partialSaid`
  names 2 reasons and counts the rest; `problemNote` 3; `alsoTail` drops
  every part past 4 and cuts each at 200; `addonReplyText` names 6 rows, 3
  placed words and 3 failed functions or jobs, their errors cut at 140; and
  (the explorer's read) the text, data and look sentences name 3, 3 × 3 and
  4. A long outcome that pushes the model past its bound is exactly the one
  whose fallback loses most. **IL21, confirmed (code), medium.**
- **Coverage is the model's own claim.** `readReply` checks only that every
  id is listed, no id is printed and the length is within the bound.
  Nothing checks that a listed fact is said, or said rightly. **R1**: only
  reading real replies against their facts can show it (§12).

## 9. Confirmed defects and untested risks

| ID | What | Evidence | Severity |
|---|---|---|---|
| IL1 | words cut at 2,000, silently, in the page and again at three server hops | P1; code | high |
| IL2 | a question cut mid-sentence, options clipped, a fifth dropped; a clipped option sent as the answer | P5 | medium |
| IL3 | a side question while a request waits drops the request (`answered: true` beside `ask`, or `answered: false`) | P3; code | high |
| IL4 | a resumed request sent to the full rewrite loses its answers, parts and round | code | medium |
| IL5 | an answer's files push out the original message's files | code | medium |
| IL6 | more than 4 parts across a question → *"couldn't keep track … just now"* | P2 | medium |
| IL7 | expiry drops the request unnamed; a reload clears the card silently | code | high |
| IL8 | at 64 needed answers, going on means retyping | code | medium |
| IL9 | after a reload the router knows six pages; a seventh page's edit becomes an addition | P6 | high |
| IL10 | an addition's declined kinds vanish on a partial success | P4 | high |
| IL11 | the routes cap nine lists before any reply sees them, with no count (MR9) | code | high |
| IL12 | a menu, picture, rules, text or rename step beside a look change never reaches the reply (review #9's cause) | P9 | high |
| IL13 | a fifth look lane dropped without a word | code | high |
| IL14 | data (21st change, rows past 60), rules (5th table), picture (9th change), nav (11th link, 9th footer item) drop silently | code | high |
| IL15 | a cut model answer said as "busy" or "try again in a moment" (take-off, look lanes, page writer) | code | medium |
| IL16 | a replacement with a straight quote or over 400 characters is dropped, and the customer is told the wording wasn't found | code | medium |
| IL17 | a step's question and the other steps' refusals leave three endings | code | medium |
| IL18 | an unsettled cost is deleted, not said | code | medium |
| IL19 | attached files never reach an addition or a picture step, silently | code | high |
| IL20 | no Stop for a running edit | code | low |
| IL21 | the page's fallback composer still caps its lists | code | medium |
| IL22 | an over-long reply is not asked again, and the model is not told the bound | code | medium |

| ID | Untested risk |
|---|---|
| R1 | reply coverage is self-reported; the wording is unchecked |
| R2 | a cut answer on the steps that don't check `stop_reason` (picker, text, data, rules, picture, nav), and reasoning tokens counted against small budgets on xAI |
| R3 | `readRouteReply` (`chat.js` 10423) makes a whole route answer unknown when one field passes its bound (bounded upstream today) |
| R4 | after the poll gives up (52.5 min) and the page's record lapses (1 hour), a finished job's ending is never shown |
| R5 | a lost lease is noticed only at a gate |
| R6 | a reused retry key returns the old, possibly failed, job |
| R7 | no body cap on the edit, add-on and question routes |
| R8 | the site note's caps may hide a large site's facts from the designers |
| R9 | a row's text value cut at 2,000 without a word (explorer's read) |
| R10 | the edit route's page writer has no clock of its own |
| R11 | the 200,000-character store bound would store unparseable JSON if reached |
| R12 | the router cannot name pages past the 24th |
| R13 | the first translation charge of a correction round missing from `cost` |
| R14 | the text step climbs to a rewrite past 600 pieces of wording (designed; cost unmeasured) |

## 10. The smallest changes, grouped

Each group fixes related problems together. Every change states the real
outcome to the reply model as a fact, or refuses with a reason; none adds a
customer sentence of its own beyond an explanation key the route already
has, and none adds a layer.

- **G1 — the customer's words whole** (IL1, IL2, IL5).
  - The composer counts and refuses to send past the bound, keeping the
    text; the routes refuse an over-bound instruction (422, cost 0, the
    number in the answer) instead of slicing at 21817, 26991 and 1036.
  - The question and option bounds are told to the model (the numbers in
    the descriptions, `maxLength` and `maxItems` where the provider keeps
    them); a longer question is kept whole up to a storage bound, never cut
    at 240; the answer history's `q` bound moves with it.
  - Resumed files keep the original message's files first, and say when
    any were left off.
  - The number (2,000) is yours; nothing measured needs it that low.
- **G2 — the pending request kept and named** (IL3, IL4, IL6, IL7, IL8,
  IL17).
  - `answered` gains a third value in the router's schema: answers it /
    asks something aside (answered, the request and its card kept) /
    replaces it (set aside, and the reply names what was set aside).
  - Expiry and `answers-full` hand the request back to the box with the
    reason (the `resume` field `clarify-unkept` already uses); a reload
    that finds the question gone says so.
  - The revise body carries `context`, `putOff` and `askRound` as the edit
    body does.
  - `editStopped`, the publish failure and the stylesheet check's catch
    carry `partial` and `ask` like every other ending.
- **G3 — every list whole, or counted** (IL6, IL11, IL13, IL14).
  - Drop `MAX_HELD`'s count (each part must still be found in the message,
    which bounds them).
  - Drop the MR9 slices; the store has seven times the room.
  - Where a step's cap stays for its output budget, the step returns what it
    left out and the route puts it in `partial` as not done; the picker's
    fifth lane is left for later through the existing held path, not
    dropped.
  - The data step tells its model when it was shown 60 of more rows, so a
    miss is reported as "not among the first 60", not as no match.
- **G4 — say what really happened** (IL10, IL12, IL15, IL16, IL18, IL19).
  - The add-on puts `declined` on every ending.
  - The merge keeps each step's own account (a list, one entry a step), and
    `editReplyFacts` reads each whatever the label.
  - A cut answer is said as too large for one go (a new explanation key,
    not "busy"); the steps that don't check `stop_reason` do.
  - The text step counts what it dropped and why, and its model is told to
    use ’ and “ ” (which compile everywhere) instead of straight quotes.
  - Files attached to work that cannot use them are named in the outcome;
    the add-on's page writer can be handed them (it takes attachments in a
    build).
  - An unsettled cost is said as unsettled, not deleted.
- **G5 — the page list from the site itself** (IL9).
  - The route reads the site's own page list when the browser's may be
    short (six or fewer stored), failing open to the browser's — as Lane 1d
    does for table names. The smaller alternative: the page stores every
    path (without markup) and refetches on open.
- **G6 — the reply's bounds and a complete fallback** (IL21, IL22).
  - The model is told the 4,000; an over-long reply gets one more call
    naming its length.
  - The page's fallback composer lists every item (counts kept), as the
    facts already do.
  - Keep 4,000 and 2,000; measure again once G3 lifts the lists.

## 11. One implementation plan

Each step below ships the way every change here does: guard tests that fail
first (a red check), a mutation sweep from a green baseline with a
comment-only control that must survive, the full suite, records, and a push
for your review. No merge or deploy until you say; no model calls.

1. **Inputs whole: G1 and G5.** `public/chat.js` (`siteSend`,
   `siteAskReply`, the resume's files, the page list), `worker.js` (21817,
   26991, the page-list read), `site-ask.mjs` (1036, the question and
   option bounds). Tests: P1, P5 and P6 kept as regression cases; the
   route refuses over-bound words with the number; a reload's router sees
   every page.
2. **The pending request: G2.** `site-ask.mjs` (`answered`'s three values,
   `liveBlock`), `worker.js` (the resume at 20626–20700, the stale-answer
   and `answers-full` replies, `editStopped`, 26522, 26582–95), `chat.js`
   (the ask branch, `reactSend`, `siteAskCheck`). Tests: P3 as a case, a
   side question keeping the request, a replacement naming what it set
   aside, expiry and a full history handing the request back.
3. **Lists and outcomes: G3 and G4.** `worker.js` (the MR9 slices, the
   merge, the add-on's declined kinds, `servedEditReply`), the step modules
   (`site-lanes.mjs`, `site-apply.mjs`, `site-rules.mjs`,
   `site-picture.mjs`, `site-nav.mjs`), `edit-failure.mjs` (one new key),
   `site-reply.mjs` (`editReplyFacts` reading every step). Tests through
   the real routes with supplied answers: five lanes, 21 row changes, five
   rule tables, nine picture changes, eleven menu links, a declined kind
   beside a success (P4), the menu-plus-layout reply facts (P9), and a cut
   answer on each step.
4. **The reply: G6.** `site-reply.mjs` (`REPLY_TOOL`, `writeReply`) and the
   page's composer. Tests: an over-long supplied reply gets one more call;
   the fallback draws every item of a long list.
5. **Your decisions, before or beside step 1:** the message bound (2,000
   or higher); whether a question keeps a longer expiry (seven days would
   match the job record); whether the router is told the previous turn's
   outcome (§5's last row — a design change, so only on your word).

What stays: Build; the routing rules apart from `answered`; every safeguard
in §7; the fixed sentences for failures of ours.

## 12. The next step, separately: the real-model audit

After this plan (or beside it, on your word): real router, picker, step and
reply calls on our test sites, to see whether real models choose the right
route, operation and target and ask the right question — and, for the
replies, whether each one says every fact it lists in `covers` (R1), how
reasoning tokens sit against the small budgets (R2), and how close real
large outcomes come to the 4,000 bound. **Not started: it needs your
approval and a cost estimate first.**

## 13. Free checks run for this audit

| # | What | Result |
|---|---|---|
| P1 | the page's composer, a 2,936-character message (the real page with its harness) | 2,000 sent; the thread shows the cut copy; no notice |
| P2 | the edit route, a step's question beside more than 4 parts across turns (supplied answers) | 503 `clarify-unkept`, *"…just now"* |
| P3 | the route, `answered: true` beside intent `ask` | the question closed; the page showed only the answer; the request was never run |
| P4 | the add-on route, one kind declined beside one added | success; the declined kind in no field |
| P5 | `readAsk`, a 261-character question, five options, a 66-character option | 239 characters ending *"…open the…"*; four options; 42 characters, unmarked |
| P6 | `routeMessage`, six stored pages, an edit naming the seventh | intent `addon`, reason `page-unknown` (all eight sent: `edit`, page `/faq`) |
| P7 | `routeMessage`, 30 pages sent, page 27 named | `edit`, reason `pages-cut` |
| P8 | the reply facts of four large outcomes (`site-reply.mjs`) | 14–40 facts; 1,406–2,748 characters; ≈1,457–1,851 tokens in; `covers` ≈66–170 tokens |
| P9 | the real edit route, the menu change and the layout move (supplied answers, sync and job) | both shipped; `msg` names the menu; facts `["c1: Updated /."]` |
| read | `edit_jobs` stored reply lengths (lengths only; read-only) | 315 jobs; largest 27,961; median 54; 99th percentile ≈17,127; none at 200,000 |

P1–P4 and P9 ran from temporary test files deleted afterwards; P5–P8 from
scratch scripts. In P6 the supplied router answer names the page (the
answer most favourable to an edit); a real router told the site has six
pages would more likely answer `addon` itself — the same misroute. Whether
the add-on's hand-back to the edit route recovers it is untested. No model
was called, nothing was spent, no container rebuilt, nothing deployed.
