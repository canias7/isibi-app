# 2026-10-23 — `fix-edit-flow`: the edit flow's live faults (not merged, not deployed)

Branch `fix-edit-flow` from `origin/main` (`80acabe4c`). The faults were found by
the live tests on `saltmarsh-and-sparrow` the same day; their root causes had
already been traced. Nothing paid, no model called, no live write. Every model
answer in the tests is supplied, in the shape its tool tells the model to give.

## What changed

**A. Routing a page's own button or hours to the menu editor.**
`builder/site-ask.mjs`, the `layer` field: the `text` clause now says it reaches
every word inside a page's own sections (a button label in a hero, a timetable or
hours written into the page, with no table storing them), and that `nav` reaches
only the frame. The `nav` clause says it reaches nothing inside a page section;
its footer-hours line says hours written into a page are `text`; "THE BUTTON" is
now "THE FRAME'S BUTTON" (the one beside the menu), a page section's button label
being `text`. Said by reach, no keyword rule. The first build's request pins in
`test/live-clarify-contract.test.mjs` were re-pinned (all six request halves moved,
all 42 reading halves measured unchanged).

**B. The text step.** `builder/site-text.mjs`: a price (`£4.25`, `4.25€`, `£4–£6`)
is prose, not an identifier (`PRICE`); sizes and bare numbers stay code.
`builder/site-apply.mjs`: `TEXT_TOOL` gains `notDone` (each requested change the
model could not make from the list, in its words); `readTextNotDone` adds entries
this code refused. `runTextEdit` returns `notDone` and `partial: true` beside what
did go in. `worker.js` carries `notDone` on the text answer; `notDoneOf`
(`builder/request.mjs`) reads it, so the part is `partial`; `editReplyFacts`
(`builder/site-reply.mjs`) states each one as not made.

**C. The add-on's "words landed" check.** `builder/site-add.mjs`: when a line is
not rendered whole, it is split at its own punctuation (quote marks, a dash, a line
break; never into single words; never a line with a link) and each piece must be
rendered whole, in order, at most 12 rendered words apart (`lineParts`,
`partsRendered`), under the same one-more-occurrence rule over every way the page
renders.

**D. The request summary.** `builder/request.mjs`: a finished part records the
text step's `changed` (`changedOf`), and `requestView` shows `made`, `changed` and,
for a partial part, `notDone`. `requestReplyFacts` no longer says "Done: <asked
words>": it says the part that asked for them finished, what its step recorded
doing, the words it wrote, and what it did not make.

**E. Carved and deferred parts.** `builder/request.mjs`: `inferNeeds` runs again
when a part's routing names its targets, so a carved part that reads a page its
parent creates waits for it, and is `not-run` (`needs:<n>`) when the parent broke;
a run that defers words records the pages it added on its part first
(`createdPages`). A part carved by a job carries `carved` in its job's `request`
(`partOf`, kept by `readRequestOf`), and the routing route (`worker.js`) charges
its routing job nothing. Parts the message's own routing held back keep their
charge, as before. `builder/site-add.mjs`: the picker names where a `frame` item
points (`scopes[].to`, `readFrameTo`); a lone frame link to a page the site lacks
is refused at no cost (`frame-no-page`) before the menu editor.

**F. The stuck customer.** `public/chat.js`: a request whose unfinished parts all
wait on the customer (a question, a go-ahead) is not running work
(`siteRequestWorking`), so the composer shows Send and Enter sends. Every step's
question field (`QUESTION_FIELD`, `builder/clarify.mjs`) now requires two to four
model-written answers; the card still adds "Something else…". "Cancel this
request" sends the card's request part, and the question route ends that part by
its own question id when the site's one slot holds another (the slot is left as it
is). Stop clears the stopped request's question; an answer refused as
`stale-question` is sent again once as a new message, under a new key.

## Tests

`test/fix-edit-flow.test.mjs`, 13 cases (A, B1, B2, C, D, E1+E2 through the real
request flow and routes, E2, E3 ×2 with E3's through the real add-on route, F1–F4,
F3 through the real question route). Updated where the behaviour changed on
purpose: `request-flow.test.mjs` (M4, M5, G1), `request-plan.test.mjs` (the reply
facts), `live-clarify-browser.test.mjs` (a stale answer is sent again),
`live-clarify-contract.test.mjs` (re-pin), and `fixtures/browser-page.mjs` (loads
`siteRequestWorking`).

Screenshots of the composer with a waiting question (Send, three model-written
answers and "Something else…"): `composer-waiting-after.png` (this branch) and
`composer-waiting-before.png` (main's `chat.js`, showing Stop) in the session's
`shots-editflow/` folder.

Readings (red check, sweep, suite totals, image prediction) are in the commit's
owner-notes entry and the hand-back.
