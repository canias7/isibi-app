# The mixed-work fixes: every operation's result kept and named (2026-10-03)

On the owner's word, for review: the correctness fixes the mixed-work audit
called for, on `claude/help-needed-ehlwlj`, **unmerged and undeployed**; no
container built; no model called; nothing spent; first Build unchanged; the
information-limits batches stay paused; the prepared real-model batch was not
run. The corrected consolidated report is
`docs/investigations/mixed-work-audit.md`; the plan for finishing Edit and
Add-on work in the same request (not built) is
`docs/investigations/edit-addon-one-request-plan.md`. This file is the record
of what changed and what was measured.

## 1. The order

> The mixed-work audit identifies the right problems, but correct its
> capability claims before proceeding: twelve registered add-on kinds does
> not mean all twelve finish together, since row and frame have exceptions;
> storing QR/3D configuration and passing it to a writer does not prove
> placement on the requested page; and controlled tests with supplied answers
> do not prove real-model routing or complete delivery. Separate what was
> actually changed and published from what was only designed, stored, handed
> off, deferred or left unverified. Remove “at most” language from cost
> estimates unless an enforced spending cap supports it. Keep the general
> information-limits batches paused. … First implement the closely related
> mixed-work correctness fixes: preserve each executed operation’s
> authoritative result through merging, queued storage and reply generation;
> report every completed, failed, declined and pending operation with its
> target; and stop silently dropping operations at the four-lane or per-step
> count limits. Remove arbitrary operation caps where the existing execution
> and resource safeguards support processing the complete list; where a
> genuine limit must remain, preserve and identify each unexecuted operation
> … Do not replace missing targets with a vague count. Let models identify
> intent, scope and unhandled parts using clear instructions and structured
> outputs … Support multiple distinct deferred passages … Preserve declined
> add-on kinds beside successful ones. Report QR codes, scenes and other
> additions as delivered only when the actual result supports that claim …
> Preserve requested versus applied schedule values … Keep normal replies
> model-written and avoid adding another reporting framework. Use focused
> grouped regression tests through the real synchronous and queued routes …
> Separately prepare the smallest concrete plan for completing Edit and
> Add-on operations automatically within the same user request … Do not
> merge, deploy, rebuild containers, spend credits or run the prepared
> real-model batch yet.

## 2. What changed

**Every executed operation's result, kept and named**
- `worker.js`, the edit merge: `steps`, one entry per step in the order it
  ran (layer, lanes, status `done`/`asked`/`failed`/`superseded`, its target —
  its own words, and its page on the page rung only — its own account,
  `removed`, `renamedTo`, cost), only when several steps ran. The queued job
  stores the answer whole, so the poll reads the same list.
- `partial` entries carry the same target and `truncated`; a change withheld
  for a page the site does not have keeps the words it was for (so a
  question beside it now keeps its own part instead of being dropped).
- `builder/site-reply.mjs` (the facts a model reply is given): each other
  step's own account (`stepFacts`); each part not done named by its target,
  grouped by reason and page, with the builder's own reason or the note that
  none was recorded; placement facts for codes and scenes; declined kinds;
  the asked and applied intervals.
- `public/chat.js` (the page's fallback composer), inline so every harness
  that cuts these functions out carries it: the look branch names its pages
  ("Updated / and /visit."), each other step's account, and each part not
  done led by its target — the page left out when the builder's sentence
  names it; the add-on reply's placement, decline and schedule sentences, and
  every list uncut.

**No silent drop at a count**
- Removed: `MAX_LANES` (4), `MAX_PICTURE_OPS` (8), `MAX_DATA_OPS` (20),
  `MAX_RULE_TABLES` (4), `MAX_LINK_CHANGES` (12), `MAX_HELD` (4), and the
  schema `maxItems` on the lane lists and on the nine list-kind addition
  tools (a schema ceiling tells a model to leave entries out before the
  cleaner can name them).
- The bound that replaces the counts is the answer itself:
  `LIST_ANSWER_MAX_TOKENS` (16,000, inside the call's 240-second limit); each
  step's ceiling grows with what it is shown (`pictureMaxTokens`,
  `dataMaxTokens`, `rulesMaxTokens`, `navMaxTokens`; the picker's with twice
  the message's echo), and an answer cut off at it is refused whole (`reason:
  "send"`, `truncated`) and said: *"The builder's answer for that part was cut
  off before it finished, so none of it was used and nothing there changed —
  this is on us."*
- Kept as genuine limits, each named when it binds: the menu's ten items and
  the footer list's eight (`why: "full"`, every item past them by name); the
  add-on's per-kind ceilings (`over-cap`, every entry past them by name —
  a line of words by its words, a photograph by what it shows); what one
  request carries across turns (48,000 characters); the 15-minute job
  minimum (said).
- Every list on the add-on's answer is uncut (`notAdded`, `droppedQrs`,
  `heldPages`, `heldParts`, function and job errors, kept pages, lost
  photographs, missing words and photographs, `unknownKit`, `dropped`), as
  are `keptParts` and `unseenParts` on the edit side.

**Several parts left for later, each the customer's own words**
- `builder/site-ask.mjs`: the site router's `alsoAsked` is a list
  (`LIVE_ASK_TOOL`); the first build's `ASK_TOOL` is byte-identical (its hash
  is pinned by `live-clarify-contract`). `readAlso` reads a string or a list
  (`also-several`), refuses any non-text entry whole (`also-not-text`).
  `heldList`, the browser's copy and the resume record are bounded by
  `MAX_CARRIED_CHARS`, not a count.
- `builder/site-lanes.mjs`: the picker's `elsewhere` — every part of the
  message no part here can make, copied exactly; the field names no kinds of
  its own (a first draft named "a photograph" and "a menu link", which
  `images` and `action` can add). `readElsewhere` keeps a part only when the
  message holds it word for word (`unread` counted). In `worker.js` each part
  is put off and taken out of every step's words and of this turn's sentence
  before anything runs; a message whose every part is another step's ends
  `picker/elsewhere` (nothing run, nothing billed, each part named).

**The add-on**
- `declined` beside the kinds added (both success answers); `qrs[]` with the
  page asked for and the pages that really render each code (`qrUnplaced`
  over the publication); `scene` likewise (`sceneOn`); `askedEveryMinutes`
  beside `everyMinutes` when the platform runs something else.

## 3. The report's corrections

`docs/investigations/mixed-work-audit.md` now: ten addition kinds combine,
`row` and `frame` are set aside beside others; a QR code or scene is stored
configuration, and placement is a separate, now-read fact (a real writer's
placement unverified); supplied answers are not real-model proof; every
outcome is classed as changed and published, designed, stored, handed off,
left for later or unverified; the batch's estimates carry no "at most" or
"up to" (nothing enforces a per-request cap); each finding's status on this
branch. The owner-notes' two "at most about 127" (the handoff, rewritten, and
the audit's dated entry) are corrected too.

## 4. The tests

- **Converted** (each asserted a defect; each now requires the fix): every
  FINDING case of `test/mixed-work.test.mjs` (MW1–MW8, now FIXED), and the cap
  and wording assertions in 30 other files — the page-step suites (screens
  name pages and each step's account), the failure screens (a part named by
  its target, not counted), the cap tests of the picture, data, rules, nav,
  lane and hand-over readers (every entry read past the old count), the
  router's list (`site-ask`, `route-decision`), the add-on schema ceilings
  (`site-add`, `addon-row`), the source guards whose windows the new branches
  widened, and the picker's size guard (re-anchored 1/8 → 2/15 for the pair,
  1/10 → 1/9 for the router, the growth named: `elsewhere`, 416 characters;
  the per-lane anchor untouched).
- **New**, through the real routes, synchronously and queued: five kinds
  together; nine photographs; two parts left for later (the router's list,
  and the picker's `elsewhere` beside the router's part); a question beside
  two steps that work; a question beside a change withheld for a missing page;
  a step's answer cut off; every part another step's; a part not in the
  message; a part cut out of a step whose words held it; the QR code and scene
  placed and unplaced; a declined addition; a schedule adjusted and not. At
  the readers: cut answers refused by the picture, data, rules and nav steps;
  `readElsewhere`; the picker's field; seven lines of words.
- `test/mixed-work.test.mjs`: **38 cases**, all passing.

## 5. Measured

- **Red check** (this round's test files run against the code before it, in
  a throwaway worktree): **142 of 1,471 fail there** across 27 files, and two
  more files do not load (they import `readElsewhere` and
  `LIST_ANSWER_MAX_TOKENS`, which the old code lacks). Every converted or new
  mixed-work case fails on the old code; the controls in the same file (the
  wording, the failed step, the dependent additions, the ceilings, the
  all-or-nothing refusal, the schedule run as asked) pass there.
- **Mutation sweep** (a scratch script: every anchor checked before any file
  is touched, every file restored from memory and its hash compared; 18 focused
  files per mutant): **35 of 35 mutants caught, 3 of 3 comment-only controls
  (in `worker.js`, `chat.js`, `site-reply.mjs`) left alone.** Each mutant puts
  one defect back: the merge drops `steps`; either reply leaves the other
  steps out; a photo or menu step claims the message's page; a withheld change
  loses its words; a part not done said without its target, or its page said
  twice; "updated / and updated /menu"; each removed count back (lanes,
  photographs, rows, rules tables, link changes, parts put off in the module,
  the browser and the resume record); menu items past ten unsaid; additions
  past their ceiling unnamed; words losing their six; the router's list
  refused; the picker's parts not named, not cut from the steps, or read as
  "I couldn't tell"; a part not in the message put off; each step's cut
  answer applied in part; a cut answer said as unreachable, or its record
  dropped; a declined kind, the asked interval, placement and its facts lost.
  **The first run left two alive (33 of 35)**, both gaps in the tests: no case
  had seven lines of words, and no case gave a step words overlapping a part
  put off. Both cases were added; both mutants are caught; the final run over
  the final code is 35 of 35.
- **Full suite**: `9115 / 9115 / 0 / 0` locally (from `9090` at `c5ecb081`).
- **Screenshots** (the page's fallback composer, the real app in Chromium):
  four before/after pairs — four kinds, two parts left for later, a QR code
  and scene saved but not shown, a schedule adjusted beside a declined
  addition. "After" renders answers captured from the real routes on this
  branch with supplied model answers; "before" renders the committed page code
  with the answer shape the old route produced. Sent in the session.
- **The image**: predicted over both ends with the repository's predictor —
  `main` (deploy 2180) `8bfc67dc695e65cc` (191 inputs); the branch before
  this round `2635a0a1fb74f8c3` (193); **this round's code `460ab6e5`
  `e60719bec1c5e023` (193)**. A merge would roll the image; nothing was built.
- **CI**: §6, after the push.

## 6. CI (read after the push)

- **Unit tests**: the run on `ddbde31a` (the code and its records) was
  cancelled by the next push, a one-file correction to the plan (one run per
  branch at a time); the run on **`f26e00e2`** — the same code — is run
  37125497316, job `test`, `success`; its log reads `# tests 9115`, `# pass
  9111`, `# fail 0`, `# skipped 4`: **`9115 / 9111 / 0 / 4`**, the local total
  exactly (CI skips four, as always).
- **The site build on `ddbde31a`**: run 37125423087, all eight jobs
  `success`; its gate's own line: *"ALL CHECKS: 404 checks in 27 sections
  across 4 shards, every job green"* (site build inputs `598f56edeafd8dea`,
  3,971 files).
