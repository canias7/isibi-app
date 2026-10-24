# 2026-10-24 — a change too big for the smaller steps splits itself (branch `auto-split-edits`)

Not merged, not deployed. Nothing spent: every model answer in every test is supplied.
From `origin/main` `1b16aaba0`.

## 1. The owner's decision

An edit or add-on that is too big for the smaller steps should **split itself into smaller parts
and carry on, instead of stopping** (owner, 2026-10-24). Before this branch (rebuild-scope, deploy
2267) such a part ended `failed` / `too-big` and the customer was asked to "send it as smaller
changes".

## 2. What changed

**The request's driver (`builder/request.mjs`).**

- When a run job's hand-over answers `split` (`handOff`: a climb, a second edit hand-over, a
  hand-over to its own layer, a chain past `HOPS_MAX`), the part is **routed again** instead of
  ending: `phase` back to `route`, `splitAsk = { why, reason }` (the step's own reason),
  `splitDepth` + 1, the job's end recorded `split`. Only when nothing of it went in (no `left` from
  the answer or an earlier try, no lost deferred words), so nothing done is redone.
- `partOf` puts the ask on the routing job's `request` as `split`; `readRequestOf` reads it back
  strictly (`readSplit`: `why` a short code, `reason` a code — a free-text reason never reaches
  the prompt).
- When the routing answers, the ask is spent. The parts it holds back (`alsoAsked`) are carved as
  usual (`carveParts`, so `dependsOn`, `inferNeeds` and the panel rows are the existing ones); each
  carved part gets the parent's `splitDepth` and `splitOf` (the part it came from), shown on the
  view as `splitOf` (and `splitting: true` while a part is being re-planned).
- **Loop guard**: `SPLIT_MAX = 2`. A part split once — or carved from one — that comes back too big
  may split once more; at the bound it ends `failed` / `too-big` with the step's reason, as before.
- **Never the rewrite**: a routing asked to split that answers `build` ends the part `too-big`,
  never the go-ahead.
- **Not split** (`SPLIT_NOT`): `build` (a change of what kind of site it is), `no-look`, `no-meta`,
  `needs-pages` (no saved design) — they end as before; `no-source` stays the build tried again.

**The router (`builder/site-ask.mjs`).** `splitBlock(split)` — "THIS WAS TOO BIG FOR ONE STEP …
(its reason: …). Split it into smaller changes … answer the first of them, and hold every other one
back in alsoAsked, copied word for word … Never answer "build"" — added after the part's section,
on a site that exists only. `routeMessage` and `askRequest` take `split`.

**The Worker (`worker.js`).** The routing route hands the router a part's `split`, or a standalone
message's `rb.split` read by `readSplit`. **A part's split routing is not charged** (as a carved
part's is not: the words were routed and paid for once). A message taken on as a request with
`split` gives every part `splitDepth = 1` (one more split at most).

**The page (`public/chat.js`, `public/edit-poll.js`).** A standalone edit's or addition's climb
(`climbed`) calls `siteRoute` again with the same words, a new key and `split` from
`EditPoll.splitOf(ho)`; the server takes it on as a request and the panel shows its parts. Once
only (a message already sent with `split` that climbs again is said, `climbSaid`), and never for a
reason in the page's `SPLIT_NOT` (the request's list plus `no-source`).

## 3. Charges

- The climbing run: as its row says (a climb charges nothing).
- The split routing of a request part: **free** (`rPart.split`).
- A part carved from it: its routing free (existing `carved` rule), its run charged as any run.
- **Known difference, the standalone path**: the page's second routing call (with `split`) is an
  ordinary message routing call and is charged as one (1–2 credits). The server cannot tell a real
  climb from a client claiming one without reading the climbed job, which is not done here. Recorded
  for the owner's decision.

## 4. Evidence

- **New tests**: `test/auto-split.test.mjs`, 8 cases — through the real Worker, queue consumer,
  edit/add-on routes and driver with supplied answers:
  S1 a too-big text part re-routed with `too-much-text`, split into the description (look) and a
  carved gallery addition, both done, the split routing and the carved routing unreserved, each run
  reserved once, no build, the view's `splitOf`; S2 the loop guard (jobs `edit, route, edit, route,
  edit`, two split asks, then `too-big` with its reason, nothing charged, nothing to press); S3 a
  `build` answer to the split ask ends too big (no go-ahead); S4 control — `no-meta` is not split;
  S5 a standalone message sent with `split` becomes a request of two parts, the router told,
  `splitDepth` 1 on both; S6 strict readers and the router's block; S7 the page's `splitOf` and the
  climb handler's wiring; S8 a part that already held another back splits and still runs on its own words.
- `test/fixtures/request-flow.mjs`: `sendMessage` passes `split` as the page sends it.
- **Red check** against `origin/main` (`1b16aaba0`) with the new test and fixture: 7 of 8 fail; S4
  (the control) passes on both, as it should.
- **Sweep** and **full suite**: §6.
- **Screenshots** (headless Chromium, the repo's own `public/`, supplied server answers):
  `shots-autosplit/1-splitting.png` (the part being re-planned) and `2-split-parts.png` (three rows:
  the description done, the gallery running, the wording waiting on it) in the session's scratchpad.
  The opening line in the shot is a supplied model line, not written by this branch.

## 5. Not done here

- The resumed watch of a standalone edit (`resumeEditJob`, after a reload) still says the climb
  (`climbSaid`): the message's own context is not kept there.
- No panel wording names the split; the parts appear as ordinary rows (the owner directs design).

## 6. Sweep, suite, image

- **Sweep** (in a copy of the tree, never the worktree; `test/auto-split.test.mjs` as the judge,
  from a green baseline): first pass 20 of 21 killed, the survivor "a carved part does not inherit
  `splitDepth`" — a guard was added to S1 and kills it. The full suite then found a real bug (a part
  0 that held another part back lost its `runs` on the split, so the held words could not be found:
  `held-unread`); fixed (the part keeps `runs`), guarded by S8, and a mutant added. Final pass: **22
  of 22 killed, the comment-only control survived**.
- **Re-anchored existing tests** (old behaviour reversed on the owner's decision): `edit-lock` (the
  two climb cases: one split re-route with `split`, then said), `edit-reply-validation` (the climb
  and duplicate-execution cases, likewise), `request-plan` (the two too-big cases run at
  `SPLIT_MAX`; below it the part re-routes), `rebuild-scope` (2) and `request-flow` F3 (the part
  splits up to the bound before ending), `canary-probes` (the probe does not send `split`), and the
  spelling guards in `site-ask` and `site-logo` (`climbed`).
- **Full suite** (this worktree, world-readable): `12632 / 12628 / 1 / 3`. The one failure is this
  machine's: `no-generated-deps`' symlink case (the worktree's `node_modules` is a symlink). The first
  run (`12631 / 12613 / 15 / 3`) found the re-anchors above and the `runs` bug; all fixed.

## 7. Already charged, across parts (the owner's extra item, 2026-10-24)

The gap `no-ask-after-charge` (3fffd0083) left: each job read only its own reserves, so a later
part of a request could still ask the customer after an earlier part's job was charged.

- **Base**: `origin/no-ask-after-charge` is merged into this branch (merge commit `07e669cbd`; two
  doc conflicts, both sides kept). The combine must take that branch with this one, or this piece's
  `charged` reads have nothing to gate.
- **`builder/request.mjs`**: `partOf` adds `charged: true` once any job of the request (any part,
  routing or run, auto-split parts included) ended with a charge on its row (`job.end.cost > 0`,
  from `chargedOf`); `readRequestOf` keeps it only when it is exactly `true`. Set by the request,
  never by a caller.
- **`worker.js`**: the edit route's `eChargedYet` and the add-on route's `aChargedYet` (from that
  branch) are true when the job's request part says `charged`, so every step's call goes out with
  no question field and states its default (`clarifyTransport`), and a question asked anyway follows
  that branch's defence in depth (default + fact; a step that still ends in a question is not charged).
- **Tests**: C1 through the real request flow (part 0's look edit charged → part 1's add-on picker
  asked with no `question` field and with `defaulted`; its supplied question becomes
  `defaulted: [{ assumed: "A gallery page", instead: "A band on the home page" }]` on the answer,
  the part done, no question waiting); C2 the record-level carry. **Red** on `07e669cbd` (that branch
  merged, this wiring absent): both fail. **Sweep**: 4 of 4 killed (partOf never says charged, zero
  cost counted, the reader drops it, the add-on route ignores it), control survived. **Not covered by
  a test**: the edit route's half (`ePart.charged`), the same one-line read as the add-on route's.
- **What the full suite found** (`12651 / 12639 / 9 / 3` on the first run with the carry):
  - Six reuse cases (correction-reuse CR 1, CR 3, CR 9c; parallel-reuse-run141 R141 3; parallel-batch
    BATCH and BATCH 2) made extra model calls: a prepared designer request that the preparation had
    seen REFUSED was, after the charge, sent without its question field, so it no longer matched the
    recorded refusal and the job asked the designer again. **Fixed in `builder/prepared.mjs`**:
    `replayer().has(req)` (that branch's) also answers yes for an unspent recorded refusal of the same
    request, so the gate sends it as prepared and the caller skips to the recorded correction as
    before. Mutant (drop the refusal check) killed by correction-reuse and parallel-batch.
  - Four cases expected a later part to ASK after an earlier part's job was charged — exactly what the
    owner's rule now forbids — and are **re-anchored**: parallel-addon-independent CC 3b,
    parallel-requests P4, parallel-batch BATCH and BATCH 2. Each now finishes every part, keeps no
    pending question, and the part's own answer carries `defaulted` with its first option (`Before`/
    `After`, `Whole`/`Sliced`, `By day`/`At night`); call and purchase counts stay "once" (the routing
    count in BATCH drops from 8 to 7: no answer to route). The old answer-and-resume tails of those
    cases are left unreachable after an early `return`, kept for the record.
- **Full suite on the final tree** (this branch with `no-ask-after-charge` merged and the carry):
  `12651 / 12647 / 1 / 3`; the one failure is the environment's `no-generated-deps` symlink case.
- **Image prediction** (`containerInputs` / `imageId`, both ends): site build container
  `2d440bd194450245` (origin/main) → `8b14c6d3e9626679` (this branch), 235 inputs, 202 paths — it
  rebuilds (builder modules changed). App build container unchanged, `65022ce71e3d7274`.
