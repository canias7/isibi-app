# 2026-10-26 — A message beside a waiting question; the map in the replay key

Branch `ask-free-msg` from `main` `8f29c37d3`. Not merged, not deployed, no paid run.

## The live case

driftwood-and-daughters-5, 19:26 and 19:28 UTC (after deploy 2277). A question from a request part
(asked 17:28 by job `bb1c3e3c`, before the map reached the page step) was still waiting. The message
"Put the reviews section above the lessons section on the home page, and make sure only I can see who
signed up to the newsletter." went to the router with the waiting question (`public/chat.js` sends any
typed message beside a question as a reply to it), the router said `answered: true`, the route set
`rInstruction = rWaiting.request`, the old part was re-prepared in the Worker (no job row, no trace),
it asked the same question again, and the newsletter half was never made a part.

## Fix 1 — `dc1590a03`

- `builder/site-ask.mjs`: the live tool has `alsoNew` (array of the customer's words); the
  waiting-question block tells the router to answer `true` and list new requests there when a message
  answers AND asks for more. `readRouting` reads it only beside `answered: true` (malformed → unusable,
  `also-new-unread`); `routeMessage` refuses an entry not found word for word in the message
  (unusable, unbilled).
- `builder/request.mjs`: `appendNewWork(rec, { key, items })` — one unrouted part per entry
  (`phase: "route"`, `route: null`, source `answer-new`), idempotent on the message key, refused on an
  ended or stopped request.
- `worker.js`: the route carries `alsoNew` into `rAsk` (both answered branches); `resumeRequestPart`
  appends it in the same save as the answer. A question with no request behind it puts the new work
  off beside the request it resumes (`putOff`).
- The client is unchanged: a typed message still carries the waiting question to the router (which
  decides); a pressed option is still `chosen`.

Cases (`test/ask-free-msg.test.mjs`, 9): pure answer resumes; answer + new returns the new words;
new words not in the message fail the call; malformed fails; `answered: false` carries none (the
route supersedes and routes fresh, unchanged); a pressed option is an answer; `appendNewWork`
behaviour; the worker wiring. Red check on `8f29c37d3`'s code: 6 fail, 3 pass (the three controls).
Sweep: 7 of 7 killed; the comment-only control survived.

## Fix 2 — `f613f27f4`, corrected by `590949cae`

First version (`f613f27f4`): the map added before the recorder/replayer, so the key held the map's
full contents. The full suite then failed 25 parallel-batch cases (PI 2–37, BATCH, BATCH 2, PC 1/4,
IND 1/5, PATH data/rules, GN 2/4, DISCOVERED, SCHEMA-ONLY, R11 LABELS): a part prepared beside another
part's job is meant to be answered from its preparation when that job changes some other page; with
the contents in the key, any change anywhere on the site threw the preparation away (a second paid
call), and R11's check saw other parts' words in the recorded request.

Correction (`590949cae`): `mapKeyed` (`builder/site-map.mjs`) — a mapped call is recorded and replayed
under its request plus a stand-in naming the map's FORMAT (`(site map, format 1)`), and the model is
sent the real map. An answer recorded with no map (the 17:28 case), or a map of another format, is
never replayed; another part's change to the site does not invalidate a preparation. The question
gate's `replayHas` (edit and add-on) checks both forms. This is narrower than "a different map digest
does not replay" as briefed; contents in the key are incompatible with the parallel-preparation rule.

Cases (`test/replay-map-key.test.mjs`, 9, running worker.js's own `jobSend`/`jobCall` with the real
recorder and replayer): same map replays; changed contents still replay; recorded with no map → fresh
call; recorded with a map, none readable now → fresh call; the key names the format and not the
contents; the page writer's transport the same; no job unchanged; the model is sent the real map under
a job; the map read once per call. Sweep: 7 of 7 killed; the comment-only control survived. Plus a
`route-decision` case for the new `also-new-unread` code.

## Full suite on `590949cae`

`12911 / 12905 / 4 / 2`. The four failures are not from this branch: `site-secrets` (fails on `main`
too), REOPEN 1 (`canary-reopen-browser`, passes alone), and BROWSER 1 / BROWSER 2
(`request-refresh-browser`), which fail the same way on `8f29c37d3` in this container.

## Not done here

Fix 3 (the full map for the router, reply composer and diagnosis, and the guard change) was paused
by the owner before any edit (steps are to explore with read-only tools instead). Fix 4 (a trace row
for preparations) was not asked for.
