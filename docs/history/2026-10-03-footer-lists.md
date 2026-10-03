# Footer lists and the menu: every entry applied or named; the plan revised (2026-10-03)

On the owner's review of the mixed-work fixes, for review on
`claude/help-needed-ehlwlj`. **Unmerged and undeployed.** No container was
built, no model called and nothing spent. First Build is unchanged, the
information-limits campaign stays paused, and the cross-route continuation
is planned, not built.

- Code: `13c22ea3`.
- The revised plan: `docs/investigations/edit-addon-one-request-plan.md`.

## 1. The order

> The mixed-work fixes are substantially improved, but finish the missed
> footer case and revise the combined Edit/Add-on proposal before
> implementing it. I independently reproduced a remaining silent omission in
> builder/site-nav.mjs: readNav receives nine valid legal-footer entries,
> keeps eight, and returns dropped: []; raw2.slice(0, MAX_LIST_ITEMS)
> discards the ninth before the new reporting logic can see it. Fix both
> legal and social footer lists through the actual reader, application,
> result and reply paths. Examine ordinary edits and add-on frame handoffs:
> every requested entry must either be applied or retain its identity and an
> accurate reason it was not applied. Do not treat “a footer should have
> eight items” or “a menu should have ten” as a proven technical constraint;
> remove those arbitrary counts where existing resource safeguards support
> the complete list, or clearly document a genuine constraint. Add focused
> regression cases with nine footer entries, existing plus newly added items,
> and an invalid entry among valid ones, checking the final page and
> customer-visible outcome rather than only the reader. Preserve the
> reporting fixes already verified. Separately revise
> docs/investigations/edit-addon-one-request-plan.md … Run free focused
> checks for the footer correction, update the docs and handoff, and push for
> review. No merge, deployment, container rebuild, paid model calls, or
> reopening of the broader limits campaign.

## 2. What the owner reproduced, and why it was silent

`readNav` read each footer list (`legal`: label and address; `social`:
network and address) through `raw2.slice(0, MAX_LIST_ITEMS)`, with
`MAX_LIST_ITEMS` set to 8, **before** any entry was looked at. The
mixed-work fixes had made every refused entry reach the reply, but an entry
the slice removed was never an entry the reader saw. So nothing refused it,
and `dropped` stayed `[]`.

The menu's count (`MAX_NAV_ITEMS`, 10) was named when it bound. But it was a
number, not a constraint: the kit's `SiteHeader`, `SiteFooter` and
`site-chrome.tsx` render every item they are given, and nothing slices.

Measured on the code before this round (`a66244e2`), through the real edit
route with supplied model answers (the "before" half of the screens, §6):

| Case | What the old code did |
|---|---|
| nine small-print and nine social links | kept 8 of each. Mastodon and Modern slavery were gone; the reply said *"8 social links, and 8 small-print links"*; `dropped: 0` |
| nine valid small-print links with three invalid ones mixed in | the slice took the first 8 entries, invalid ones included, and kept 6. Returns, Complaints, Modern slavery and the blank entry were cut unsaid, and *"Old terms"* got no reason (*"it wasn't usable there"*) |
| the add-on's frame hand-off: six new links beside three | *"Added 5"*: the room left under 8 was 5, and the sixth link was cut unsaid |
| links in the copy: one repointed beside two refused | only the first refusal was said |
| a menu of twelve items | ten kept; *"Wholesale"* and *"Jobs"* refused against *"the menu holds at most 10 items"* |

## 3. What changed

**`builder/site-nav.mjs`**
- **No count of menu items or footer entries.** `MAX_NAV_ITEMS` and
  `MAX_LIST_ITEMS` are gone, from the reader (`readNav`) and from the add-on's
  frame hand-off (`additionOnly`, `newItems`, `frameNow`, which no longer
  computes room).
- **Every entry is read.** An entry that is not an object at all is still
  something they asked for. It is kept on `dropped` as `incomplete`, with the
  list it was for.
- **Every refusal has its own sentence** (`itemsLeftOut`):
  - `no-such-page` and `page-local` keep their sentences;
  - `duplicate`: *"it was listed twice"*;
  - `incomplete`: *"it had no name or no destination"*;
  - `bad-number`: *"that isn't a phone number a link can call"*;
  - `not-a-path`: *"a link here goes to a page of this site or a full
    https:// address"*;
  - `offsite`: *"an address starting with // can't be used — give the full
    https:// address"*;
  - `bad-anchor`: *"that isn't a section name a link can point at"*.
- **The reply names each list's entries** (`navReply`): *"9 small-print
  links (Privacy · Terms · …)"*, where it said a number.
- **Every refused link in the copy is named** (`linkRefusal`): one refusal
  keeps its exact old sentence; several are each named, with their own
  reason.

**`worker.js`, the menu step's answer**
- `dropped` carries each entry left out: its words, its address (never a
  `tel:` number), its reason, and its list or button. `refusedLinks` carries
  each refused link's words, from, to and reason. Both were counts before.
  `lists` still gives the counts applied.

**What bounds a menu or a footer list now**
- **The step's answer ceiling** (`navMaxTokens`, which grows with what the
  step is shown, held to `LIST_ANSWER_MAX_TOKENS`). An answer cut off at it
  is refused whole and said (the mixed-work fixes).
- **Each label's length** (`MAX_LABEL`, 40 characters) and each contact
  field's (160). These are genuine information limits, stated where they
  bind and left for the paused batches.
- **Each entry's destination**, checked one by one. Every refused entry
  keeps its identity and its reason.
- **The answer's own size** inside the stored job answer (200,000
  characters). No real list comes near it.

**Examined and left as they were**
- The ordinary per-page menu changes (`menuChange`, `menuApply`) and the
  list writer (`applyChromeList`) apply every entry they are handed. The cut
  was only in the reader and the hand-off's room.
- The facts a model reply is written from (`editReplyFacts`) read the
  answer's entries, so the model reply names them as the page's composer
  does.
- **Not changed, recorded in the backlog**: a list entry or a menu link that
  the add-on **sets aside beside other kinds** is named by its kind, not by
  its words. The add-on picker answers kinds only, so the route never learns
  which link was asked for. The plan's add-on `scopes` (§9.1) is what would
  carry them. A **lone** frame handed to the menu step is covered: every
  entry is applied or named.

## 4. The tests

- **New, in `test/mixed-work.test.mjs`** (§3c), each run synchronously and
  queued (10 cases). Each reads the stored pages of every page with a frame,
  the publishes, the answer, the page's own reply and the facts a model reply
  is given:
  - nine small-print and nine social links in one edit (all eighteen on
    every footer, the frame otherwise unchanged, one publish, every entry
    named);
  - three invalid entries among nine valid ones (all nine kept, and each
    refused entry on the answer and in the reply with its own reason, never
    counted);
  - the add-on's frame hand-off adding six links beside three (all nine in
    order, *"Added 6 … (Accessibility · …)"*);
  - links in the copy, one repointed beside two refused (each named);
  - a twelve-item menu, and eight items added by the frame hand-off (every
    item, past the old ten).
- **New at the readers**:
  - `test/site-nav.test.mjs`: a footer list keeps every valid entry, and
    names each refusal, including one that is not an entry at all;
  - `test/frame-addition.test.mjs`: `additionOnly` adds every new item,
    whatever the menu's length.
- **Converted** (each asserted the old count):
  - the menu-count case in `site-nav.test.mjs` (40 items kept);
  - `frameNow` no longer reports a room (`frame-addition.test.mjs`);
  - the social frame addition's reply now names its entry
    (`edit-removal-door.test.mjs`);
  - the Worker wiring guard's window, widened for the answer's entries
    (`site-nav.test.mjs`).
- **The reporting fixes already verified are kept.** Every earlier
  mixed-work case passes unchanged, and so do the four files' other 273
  cases.

## 5. Measured (all free)

- **Red check**: this round's four test files run against the code before
  it (`a66244e2`), in a throwaway worktree. **16 of 289 fail there**: the ten
  new mixed-work cases, the two new reader cases and the four converted
  ones. The other 273 pass. On `13c22ea3`: 289 of 289.
- **Mutation sweep**: a scratch script; every anchor checked before any file
  is touched; each file restored from memory and compared by hash; four
  files per mutant. **10 of 10 mutants caught, and 2 of 2 comment-only
  controls (in `site-nav.mjs` and `worker.js`) survived.** Each mutant puts
  one defect back:
  - the footer's count of eight, silently;
  - the menu's count of ten;
  - an addition's room;
  - a non-entry skipped unsaid;
  - a refused entry's own reason not said;
  - a bad phone number's reason not said;
  - only the first refused link said;
  - the footer reply counting instead of naming;
  - the answer losing each entry left out;
  - the answer counting refused links.
- **The menu-related group**: 23 files (the menu, contact, layout, removal
  door, frame, hand-over, edit-failure, canary, reply and page-keep suites),
  §7.
- **Full suite**: §7.
- **Screens** (sent in the session, `footer-before-after.png`):
  - **the bakery's published footer**, built with the real build service and
    kit from the pages each code version stored, served as production serves
    it, and rendered in Chromium. Before: eight social icons and eight small
    print links. After: nine and nine;
  - **the page's own replies for the five cases** of §2, before and after.
    The page code is the same in both (nothing under `public/` changed); the
    answers are the real route's, with supplied model answers.
- **The image**: predicted over both ends with the repository's predictor.
  `main` (deploy 2180, `b8d12ff9`) is `8bfc67dc695e65cc` (191 inputs); the
  previous round is `e60719bec1c5e023`; **this round's code `13c22ea3` is
  `0fdaaed0307d812a` (193 inputs)**. A merge would roll the image. Nothing
  was built.

## 6. The plan, revised (not built)

The owner's review found two faults in the first plan:
- the browser-driven continuation stalls when the tab closes;
- its separate `pending → running` mark defined neither how execution
  claims the part nor how a crash is recovered.

The revised plan (`docs/investigations/edit-addon-one-request-plan.md`)
replaces both with the server's own job machinery:
- An accepted message becomes one **request** row: the original message,
  durable file copies, the answers, and its parts. Each part has its words,
  its scope and target, and the parts it needs.
- Each step of a part (routing it, running it, each hand-over) is an
  ordinary `edit_jobs` row, filed under a key derived from the request, so
  filing it twice finds the same row. The claim, lease, site lock, reserves,
  publish marks, refunds, sweeps and reconcile are reused unchanged.
- A small **driver** files the next runnable part when a job ends: in the
  consumer, through one gateway call from the container, and after an
  answer. The two-minute cron is the guarantee. This copies the rebuild
  drain's pattern (`rebuildIdem`).
- The model names which parts need which (two fields on the site's routing
  tool; the first build's tool unchanged). Code enforces the order: cycles
  are refused, carved parts strictly shrink, and textual order is only a
  tie-break.
- The plan specifies:
  - routing, execution, publication and charges separately, with a recovery
    table (a lost 202, a lost `edit_create` answer, a duplicate delivery, a
    crash before, during and after a publish, a dead driver);
  - what happens when a continued part defers work, asks, fails, renames the
    site, needs the full rewrite, or is cancelled;
  - "queued" until a runner claims the job; done, failed, waiting,
    unverified and done-unrecorded kept apart;
  - the failure policy (B proposed: stop only what depends on a failure,
    with A one setting away);
  - the exact files, nine decisions, and grouped tests: one-message Edit
    plus Add-on, dependency ordering, clarification, closed-tab recovery,
    duplicate delivery, and the unchanged guards.

**Found while revising it**: the page itself makes the three existing
hand-overs (edit → add-on, a sideways hop, add-on → menu step), so closing
the tab between the two jobs loses the second half. The plan moves them to
the server. They are recorded in the backlog, not changed.

## 7. Checks after the records (filled after the runs)

- **The menu-related group**: the 23 files run again on `13c22ea3`,
  **1,139 of 1,139**. An earlier reading of 1,138 was taken before the last
  reader case was added, so it is not used.
- **Full suite**, on the final tree (`13c22ea3`'s code with these records):
  **`9126 / 9126 / 0 / 0`** locally, from `9115` at the mixed-work fixes.
- **CI**: §8, read after the push.
