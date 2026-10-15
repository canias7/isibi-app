# 2026-10-15 — The assistant's conversation: personality, site advice and follow-ups

On `candidate/new-on-main`, on top of the reviewed `047b51eb`. Commit
`b66daa8c`, then `f7ac41b7` (the first build's router re-pinned on purpose,
after CI on `b66daa8c` failed that one pin; each answer's whole evidence
kept). Unit CI is green on `f7ac41b7` (run 38753086868), and on the records
head `67a3bc28` (run 38754343461: 11,064 passed, 0 failed, 48 skipped).
Unmerged and undeployed. No container build, no live storage
write, no paid call and no image purchase was made for this round.

## What was there, and what was built on it

**Already in place on the candidate:**
- The talk route: the router decides talk from work, and a separate reply call
  writes the answer (`builder/site-converse.mjs`).
- The conversation window the page sends, cut and said to be cut.
- The owner's site as the route can read it: the stored pages' words, table
  names and columns (never a row), and the file library.
- A waiting question kept open through side talk.
- A follow-up written out in full in `resolved`.

This round extends those. It adds no new store and no new job awareness.

**Every conversational reply is still the model's own.** No fixed greeting,
advice, clarification message or keyword template was added anywhere.

## The changes

**The reply (`CONVERSE_SYSTEM`):**
- **Length matched to the need:** a sentence or two for a greeting or a quick
  fact, as much as is useful for an explanation, comparison, review or plan.
- **Warm by being useful, not by being excited:** no stock openings, no praise
  of the question, exclamation marks rare.
- **Talking about their site** keeps three things apart:
  - what the stored pages say, stated as fact with the page named;
  - what is suggested, stated as a suggestion with the reason;
  - what is not known, and what would settle it.
- **Explaining a page** is done from its stored words.
- **Improvements** are the few that matter, most important first, each with
  why.
- **Comparisons** say which option it would choose, and why.
- **Missing information** is named, and the reply gives the best answer
  without it or asks the one thing that settles it.
- **Plans:**
  - options are numbered, so "the second one" can be answered;
  - a plan being refined is restated as it stands;
  - when a plan is ready, it says in a sentence how to set it going;
  - not every reply ends with a question or an offer;
  - nothing is claimed as done.

**The router (`builder/site-ask.mjs`):**
- **Thinking it through is conversation:** ideas, opinions, a review of the
  site, what to improve first, a plan, and refining that plan.
- **A plain go-ahead is work:** "go ahead", "do it", "use the second idea",
  "do that on every page". It is written out in `resolved`, and never answered
  with a request to confirm what they just said.
- **`resolved` is told how to write the common follow-ups:**
  - the second item of the most recent list, copied out;
  - the style the conversation actually named, spelled out;
  - the change on every page, by address from the site's page list.
- **New optional field `unclear`,** on "ask" only. When a reference could
  mean two things, or points at a part not shown, the router names what is
  unclear and the candidates it can see.
  - It is read strictly: text, at most 300 characters.
  - Its reason codes are `unclear`, `unclear-unread` and `unclear-ignored`.
  - The route hands it to the reply, which asks one focused question in its
    own words.

**The router's window (`routerHistory`).** The latest assistant reply is now
shown up to 3,200 characters, every other turn keeps its 800, and the total
is 6,400.
- **Why:** a reply listing five ideas runs past 800 characters, so "use the
  second idea" could point past the router's cut even though the reply's own
  call had seen the list whole.
- **The cost:** the routing call grows only when a long reply is there to
  show, by at most about 2,400 characters (roughly 600 input tokens).

**Video and audio** are untouched: hosting of the owner's own uploads only,
with no generation.

## Offline checks

**`test/conversation-boundaries.test.mjs`, 8 cases, through the real route
(the router and the reply supplied):**
1. **The router's window:** an idea past 800 characters in the latest reply is
   shown whole, and older turns keep their 800.
2. **Discussion without execution:**
   - "what would you improve first" and a refinement of the plan are answered
     by the reply's own call and start nothing;
   - the router is told that thinking it through is talk;
   - the reply is told to keep facts, suggestions and unknowns apart, and to
     prioritise.
3. **A clear follow-up runs:**
   - "use the second idea" runs the request written out, with no reply and no
     question back;
   - the second idea, past 800 characters, was in the router's window;
   - `resolved` is told how to take it.
4. **"Do that on every page":** the router is shown the site's page list, and
   told to write every page out by address.
5. **An ambiguous reference:**
   - "use the second one", against two lists, is "ask" with nothing written
     out;
   - the reply is given the `unclear` note and told to ask one focused
     question;
   - with no note it is not told to;
   - on work the note is left out (`unclear-ignored`).
6. **Cut history:** a reference into a part the page cut is said to both
   models, and the reply asks about exactly that part.
7. **Returning from a side question:**
   - the waiting question survives the side talk, and the reply knows it is
     open;
   - the answer typed next closes it, and runs as work with the question and
     its request in front of the router.
8. **The reply's instructions:** natural length, no stock enthusiasm,
   numbered options, no closing offer on every reply, and no sentence to send
   as is.

**How they were checked:**
- **Red check on `047b51eb`:** 7 of 8 fail there. The side-question return
  already held, and is kept as a pin.
- **Sweep:** 8 of 8 mutants killed, control survived.
- **Restated guards, same intent, new wording:** the length and tone
  sentences (`test/conversation.test.mjs`, `test/site-ask.test.mjs`). Three
  decision cases were added for the new codes (`test/route-decision.test.mjs`).
- **The focused set on the candidate:** 722 of 722. That covers the
  conversation, router, site-ask, media, build-reconnect, entry, question and
  request-flow files, and the workflow guards.

## The live conversation batch (`scripts/media-verify.mjs`, `converse` mode)

**Six cases were added to the existing six:**

| Case | Message | Thread | Expected | Objective checks |
|---|---|---|---|---|
| C9-advice | "What would you improve first on my site, and why? …" | none | talk | conversation, nothing started (sent only if the pages read) |
| C10-brainstorm | "Give me three ideas for a new headline … Don't change anything yet." | none | talk | conversation, nothing started |
| C11-second-idea | "use the second idea" | three numbered headline ideas | **work** | routed as work, written out, no question back |
| C12-ambiguous | "use the second one" | a headline list and a colour list | talk | conversation, **nothing written out** |
| C13-every-page | "do that on every page" | a footer line agreed for the home page | **work** | routed as work, written out, no question back |
| C15-keep-style | "keep that style for the Visit page too" | a style named and applied to the home page | **work** | routed as work, written out, no question back |

- **The threads are fixed** (`FOLLOW_UP_THREADS`), so nothing depends on a
  model's earlier answer.
- **A case expected to route as work is sent to the routing route only.** The
  harness never posts the work, so nothing on the demo site changes. The route
  may close a question that is waiting on that site, as any work message does.
- **Each case's meaning is unverified.** The whole answer, or the written-out
  request, is kept with its evidence and hints for Codex:
  - for a go-ahead: the thread it leaned on, and what was written out;
  - for C12: whether the router named what was unclear;
  - for C9 and C10: whether the ideas are numbered.
- **Returning from a side question** cannot be set up by the press, which
  sends routing only. It is offline (case 7) and, live, the optional E2 in the
  same batch: clarification, then a side question, then the answer, then the
  work resumed, driven by the UI canary in the real app
  (`docs/history/2026-10-15-verification-proposal.md`).
- **A follow-up carried out end to end** is the optional E1 in the same batch,
  driven the same way. Neither needs the owner to type anything; the press is
  their one act.
- **Demo sites need no restore:** an executed case may leave its change in
  place.

**Estimates, not limits:**

| | Cases | Each | Total |
|---|---|---|---|
| Talk | 9 (C1–C5, C8, C9, C10, C12) | 2–6 credits | 18–54 |
| Go-ahead (routing only) | 3 (C11, C13, C15) | 1–6 credits (up to 6 if answered as talk) | 3–18 |
| **The press** | **12** | | **about 21–72 credits** |

The ceiling typed per press is checked before each send (spend so far plus the send's upper estimate) and against the ledger after. It is not a cap: a send is never cancelled, so one send can carry the press past it, which is then detected and stops the press. Only the balance is a hard bound.
`IMAGE_PURCHASES` must still be off on the live Worker before every send.

## What stays a gap

- **What a real model writes,** and how often it routes these boundaries
  rightly. That is the live batch, and its meaning is read by a person.
- **Memory across sessions** stays the page's own thread; persistent memory
  is separate work.
- **What is happening right now:** nothing new tells the assistant that a job
  is running. Job awareness is separate work.
- **Returning from a side question, and a follow-up carried out,** live: not
  run until live execution is authorized for E1 and E2 (optional, in the same batch; about
  5–32 and 4–30 more credits).
