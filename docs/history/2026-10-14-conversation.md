# The conversational assistant (2026-10-14, branch `new`)

The owner's request (after Codex's review of `9ceca1d4`): *"improve the
chat-only behavior … Remove the rigid 1–3-sentence/no-Markdown restriction and
blanket bans on headings and bullets. Make the assistant naturally helpful,
conversational and appropriately detailed … All ordinary customer wording must
come from the model, not canned replies. Give conversational answers an
appropriate output budget without blindly increasing every routing call.
Connect normal conversation history … Supply relevant owner-authorized site
context … Replace the fixed capability list's 'anything else is unsupported'
rule with accurate capability guidance and honest uncertainty. Never claim
inspection, browsing or execution that did not happen. Planning, attachment
discussion and side questions during pending clarification must remain
conversation … Preserve pending work during side questions and route explicit
action requests with their conversational references resolved. Preserve
existing execution contracts rather than broadly rewriting the router."*

Unmerged, undeployed, no paid model call. PROGRESS_TALK is untouched (off).

## 1. What was there

- The router (`builder/site-ask.mjs`) wrote the reply itself, inside its
  routing tool: *"one to three sentences, plain, no markdown"*, *"No headings,
  no bullet points"*, at a 700-token ceiling shared with the routing decision.
- It was sent the current message only — no conversation — and a site digest
  of names, page paths and table names.
- A fixed capability list ended *"It cannot do anything else, and if you are
  asked about something not on that list, say plainly that it is not something
  the builder does"*.
- `answering` (any reply while a question was on screen) and `attached` (any
  file) turned a conversational answer into work (`ask-while-answering`,
  `ask-with-attachment`): "wait, can you take payments?" typed under a first
  build's question started the build; "what do you think of this logo?" with a
  logo attached ran an edit.
- On a live site, a message beside a waiting question closed it *before* the
  router read the message, and a reply to the question that was not an answer
  closed it as "superseded" — a side question lost the waiting request.
- The browser escaped the reply and drew no Markdown.

## 2. What it is now

**Two calls, each sized for its job.** The router still decides what a message
is, on its own ceiling, and for conversation writes only a gist (`answer`). When
— and only when — the router answers `ask`, the route makes the reply's own call
(`builder/site-converse.mjs`, `converse`): no tool, `CONVERSE_MAX_TOKENS` 2,400
(about 1,500 words of room), told to match length to the question and to use a
small Markdown set (`##`/`###` headings, bulleted and numbered lists, bold,
inline code, http(s) links). Its usage is billed with the routing call, under
the same charge (and the same ledger ref when the message has a key). A
routing call with no conversation shown keeps exactly its old ceiling; one
shown a conversation gets `RESOLVED_TOKENS` (400) more, the room to write a
request out (below). Work never reaches the reply's call.

**What the reply is shown.**
- *The conversation*: the page sends this project's own thread
  (`ChatTalk.historyWire`, `public/chat-talk.js`) — `{ role, text }`, the message
  being sent left out, a question's offered answers kept, a reply still being
  written skipped. The server reads it strictly (`readHistory`: roles `user` /
  `assistant` only, never coerced; 30 turns, 4,000 characters each, 24,000 in
  all, newest kept) and says every cut in words ("N earlier messages are not
  shown here. Do not assume what they said."). The router is shown a smaller
  window (8 turns, 800 characters each, 4,800 in all). The server keeps no copy:
  the thread is the browser's, per project.
- *The owner's site* (`readConverseContext`, in `worker.js`), read only after
  the router said conversation, only for the verified owner, each read bounded
  to 3 s: every stored page's own words (`extractText`, the text lane's reader;
  1,500 characters a page); every table's name, columns and access
  (`readStoredSpec`, `accessLabel`) — **never a row**; the file library by name,
  kind, size and address (`siteUploadList`, never a visitor's upload, never the
  contents). Anything that could not be read is said as not known, never as
  none. A first build is told there is no site yet, its brief and the questions
  already answered.
- *Files attached to the message*: by name and kind only, with "you were not
  shown their contents".
- *A question of ours still waiting*: said, and that it stays open.

**What it is told it did not do** (`HONESTY`): it has not opened the live site,
visited an address, searched, run or tested anything, changed anything, or
watched or listened to a file; it never says or implies it did; it never
invents a page, table, feature, file or number; when the answer depends on what
it was not shown, it says so and how to find out.

**What the builder can do** (`CAPABILITIES`, one statement read by the router
and the reply): what is known to work, what is not offered today (visitor
video/audio uploads, app-store apps, email campaigns, editing video or audio,
code run elsewhere), and for anything else: say honestly you are not sure,
suggest describing it as a request or a way to get close, never promise and
never flatly say impossible when you only do not know. The old "cannot do
anything else" rule is gone.

**Conversation is not work.** The router's `ask` clause and its `CONVERSATION
IS NOT WORK` paragraph: a question, an idea or plan, a request for suggestions
or a comparison, talk about attached files, a side question while ours waits —
all `ask`, even about a change they might make later.
- Only an answer **picked** from our own options (`picked`: a pressed option,
  or Continue on the card) is never read as conversation (`ask-while-answering`,
  narrowed). A typed reply under a first build's question may be a side
  question: the router is told so, an `ask` keeps the round (the page takes the
  pair back out of `qa`), and the question stays on screen.
- `attached` no longer reaches the router at all.
- On a live site, a typed reply the router reads as a side question (`ask`,
  `answered: false`) leaves the question waiting (`ask: { answered: false,
  waiting: true }`), and the page keeps its card. A message with no claim
  beside a waiting question is routed first and the question is closed only if
  the message is work or a question of its own — still before anything runs or
  is charged, and a close that fails or loses its race still stops the message
  at no cost (`askBusy`, `rStoreFailed`). The router is now called before that
  close (so a lost race costs the routing call nothing — it is not charged).

**Talk becoming an explicit action** (`resolved`): when the latest message is
work that leans on the conversation ("ok, do that", "the second one"), the
router writes the request out in full in their terms. It is read only on work,
only when a conversation was shown, only as text no longer than a message
(`resolved`, `resolved-unread`, `resolved-ignored`), and it runs in place of the
typed words — on the page (`run`, and a first build's brief), and on the server
for a request it takes on (`acceptRequest`'s `instruction`). Held-back parts are
copied from it.

**The reply on the page.** The reply is kept with `md: true` and drawn by
`ChatTalk.markdownHTML`: escaped first, then headings (one small size),
lists, paragraphs, bold, inline code, and links only to http/https; anything
else stays text. Every other message is drawn as before. Styles: a few rules at
the end of `public/styles.css` in the thread's own type (screenshot sent:
`reply-markdown.png`).

**When the reply cannot be written** (the call fails or says nothing), the
router's gist is shown (`replyFrom: "router"`) and only the routing is charged.
`replyFrom: "conversation"` otherwise; `replyCut: true` when the reply reached
its ceiling.

## 3. What was kept

The router's tool, its intents, `answered`, the edit/add-on/build readers, the
clarify contracts, the request flow, the size policy, the ledger rules and
every fallback are unchanged except as named above. The first build's routing
request moved (new prompt text) and exactly three readings moved, all `ask`
staying `ask` — typed `answering` twice, `attached` once — re-pinned in
`test/live-clarify-contract.test.mjs` with the reason.

## 4. Tests

New: `test/conversation.test.mjs` (13), `test/conversation-route.test.mjs` (9,
the real `POST /api/site/route` on the real Worker with storage and the model
wire supplied: a multi-turn conversation with its cut, a detailed answer whole,
grounded page words, missing information said as unknown, attachment talk, side
questions as a reply and as a new message, work still replacing a question,
"do that" running the written-out request, a reply that fails, billing, owner
isolation and no row read), and two browser cases in
`test/site-route-failure.test.mjs` (the thread and file names sent, the reply
drawn with its marks; "do that" posting the written-out request). Updated:
site-ask, route-decision (five new codes), live-clarify-contract,
live-clarify-continue, site-route-failure, site-entry-inventory, canary-probes
(a probe sends `picked: false, history: []`), model-limits, site-busy (the
ninth bare source read is the conversation's), site-apply, dockerfile
(`builder/site-converse.mjs` in the worker tree: the job runner imports the
router).

Mutation sweep: 23 of 23 killed, the comment-only control survived.

## 5. What is not shown

What a real model writes — length, tone, whether it keeps to the honesty rules,
whether a real router writes `resolved` well — is a live reading, and no paid
call was made. The reply is told attached files are unseen: no image is sent
to it. The conversation lives in the browser, so another device has the
thread its own copy holds.
