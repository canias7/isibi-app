# Remaining edit-path checklist

## The two findings from the rollback round (2026-09-26), and the rule-key defect found in their review — fixed on the branch, for review, not merged

After reviewing the merged batch, the owner asked for both findings to be
closed together before the paid Test 3. The work was to use focused tests and
required CI, and to come back for review before another merge or deployment.
Nothing here is merged, deployed or dispatched. Every model answer in the
evidence is supplied, so the tests prove what the route and the browser do with
an answer, never what a real model answers. **The runtime verification of
deploy 2160 is still pending**: the session's dispatch was refused (403), so
nothing here has read the live Worker (the press is at the end of this
section).

| Item | Status | Evidence |
| --- | --- | --- |
| An old stylesheet rule that matched nothing held an unrelated edit, and the correction round rewrote the stylesheet nobody asked about | reproduced defect, fixed on the branch | A publish is held only for the rules this request wrote. On the unfixed code the menu edit ran a correction and a second build, and the stored sheet was rewritten (each checked on its own). |
| A new rule that points at nothing is still held and corrected | demonstrated (both money paths) | The correction is asked about that rule alone, never the old one. The job's second publish checks the corrected rule, and the correction that lands is stored. |
| A container still on the previous image | demonstrated (job) | It judges every rule, and the route's own filter still holds the publish for the new rule alone. |
| A failure of ours whose restore was refused too said only "our build service was restarting", while the change stayed saved and the next edit shipped it | reproduced defect, fixed on the branch | Every arm of the failed-publish sentence now says the change is still saved when the restore failed. Driven on both money paths, plus a gate refusal, a real compile failure and a cancel. |
| The add-on route logged a revert that failed and still called the site untouched | reproduced defect (the same class, one route over), fixed on the branch | The reply now says the addition is still saved. |
| Review finding: the rule key collapsed whitespace inside quoted values, so a lane that respaced `[data-label="a  b"]` to one space shipped a selector matching nothing, unjudged | reproduced defect (both money paths), fixed on the branch | The compiler was sent `cssVerify: []`, the job committed, and the screen said the look was updated. Now the respaced rule is sent to be judged, found dead against the page, and corrected (both paths), or refused when the correction still misses (job). |
| The same collapse on quoted declarations, quoted at-rule conditions, escapes and whitespace before a colon inside a selector | reproduced (unit), fixed on the branch | Thirteen more pairs answered `[]` on the old module, each measured; each is now named. A quoted declaration and a quoted `@scope` root are also driven through the route. |
| The harmless formatting control | demonstrated, kept | A sheet answered back with only the whitespace CSS ignores is sent to be judged for nothing (both paths); also held over 1,500 random sheets carrying quoted values and escapes. |

**1. A publish is held only for the rules this request wrote.**
- The route records the sheet the css lane was shown and the sheet it stored.
  The rules that differ between the two are this request's
  (`changedSelectors`). Only those are sent to the build service
  (`cssVerify`), and only those can hold the publish.
- "Differ" is decided per rule: the at-rules around it, its selector list and
  its declarations. Whitespace that CSS ignores does not count. A rule the
  request recoloured is judged even though its selector is old, because the
  request wrote it.
- The build service judges exactly the named rules the sheet has
  (`selectorsToJudge`). With no list it judges every rule, which is what every
  build and every publish that asks nothing does.
- Scoping the measurement, not only the decision, keeps a new rule in view.
  The report caps its dead list at 24 and the judge caps its selectors at 300.
  Both count from the top of the sheet, where old rules sit, while a lane
  appends its new rule last.
- The spine also filters the report by the list. That is the belt for a
  container still on the previous image, which judges every rule whatever it
  is sent.
- The hand-over to the publish is made only once a changed sheet is stored. It
  used to be made when the css lane was picked, before the lane had answered.
- One walker serves `plainSelectors` and `changedSelectors`, because the gate
  matches the two lists by equality. Before the change, the old and new
  `plainSelectors` were compared over 27,622 stylesheet-like inputs (4,848 with
  selectors), and no difference was found.

**2. A failed restore is said by every formatter.**
- `compileMsg` takes the restore's result (`kept`) on every arm. Where an arm
  said "nothing was changed", it now says "your live site wasn't changed". Every
  answer then ends with one sentence: "The change itself is still saved,
  though, so it could go out with your next edit."
- That sentence (`KEPT_CHANGE_NOTE`) is one constant, shared by `compileMsg`,
  the stop helper `editStopped`, the correction round's catch, and the add-on
  route's failure reply.
- The route's own compile sentence now reads "That didn't compile, so your live
  site wasn't changed." when the change stays saved.
- Nothing claims a rollback or a refund. Each path's money is stated from what
  it recorded: the direct path keeps what it collected, and a queued job is
  refunded by the consumer.
- "Not published" and "not saved" are separate statements. The first sentence
  says the change did not go through; the second says it is still saved.
- The exact screens, driven:
  - Direct, the store refusing the publish: "⚠️ That didn't go through — our
    build service was restarting. Try again in a moment. The change itself is
    still saved, though, so it could go out with your next edit. This edit
    cost 2 credits. Reading your message cost 2 credits." The ledger holds the
    one debit of 2.
  - Queued, the same: the same first three sentences, then "This edit cost you
    nothing." The job is refunded.

**3. A quoted value, an escape or a selector's own whitespace is part of the
rule** (the owner's review of item 1: *"Preserve meaningful whitespace and
escapes inside quoted selectors, declarations and at-rule conditions. Normalize
only where equivalence is established; uncertain differences should remain
changed."*).
- **Reproduced first**, through the real edit route on both money paths. The
  page carries `data-label="a  b"`, and the css lane, picked beside a menu
  change, answered the sheet back with the value respaced to one space. The
  compiler was sent `cssVerify: []`, one build shipped the broken selector, the
  job committed, and the screen said "✅ Updated the look — the design. …".
- **The cause was two layers.** The key collapsed whitespace and stripped it
  around punctuation everywhere, strings included. It also read the walker's
  blanked copy, where comment-shaped text inside a string had become spaces.
- **The fix is bounded to the key.** The walker also cuts each rule's own text
  at its offsets. The key reads that text keeping strings, escapes and unquoted
  `url(…)` as written. Whitespace is dropped only where CSS defines it as
  nothing: at either end; next to a comma; next to a block's `{`, `}` or `;`;
  next to a declaration's own colon and its `!`; next to a feature's colon in a
  condition. Empty declarations are dropped too. Every colon in a selector
  keeps its whitespace. What the build service judges is unchanged.
- **The direction:** anything else reads as changed and is judged. That covers
  quote style, an empty selector-list item, a no-break space, whitespace inside
  an unquoted `url()`, and a second colon in a value. One equivalence is new:
  empty declarations, which the old key read as changed.

**What these cases assert.** Each one checks the stored configuration, the exact
browser reply, the ledger and the next edit:
- The menu-edit case: the next edit builds once with the same sheet.
- The failed-restore case: the next edit ships the saved change, exactly as the
  sentence warns.
- The controls: when the restore lands, nothing is said about a saved change,
  and the next edit does not ship it.

**Evidence.**
- `test/edit-failure-paths.test.mjs` goes from 29 to 39 cases: 4 removed and 14
  added. The 4 removed were the previous round's "the correction was the only
  config write" cases and their controls. Their premise, a correction running on
  an unchanged sheet, is exactly the defect this fixes, so the shape cannot be
  built any more. `test/css-scope.test.mjs` is new, with 5 cases. The add-on
  route gains 1 case.
- **Red on the unfixed `222d1182`: 14 failures.** Those are the 12 new behaviour
  cases and 2 re-anchored guards. The new cases that pass there should pass
  there: the two restore-lands controls, the cancel case (its sentence was
  already right), the reachability case, and css-scope's four reader cases.
- **Re-anchored, not appeased**: four older guards read the exact code this
  changes (`edit-queue`, `site-migrations`, `edit-reserve-refused`,
  `publish-clock`). `publish-clock` sat outside the 47 focused files, and only
  the full suite found it. It now asserts the order it cares about, and an
  order mutant turns it red.
- **Probes, not a sweep**: `scripts/mutants/css-scope.json` killed 19 of 19,
  with 0 survived, 0 never applied and the control surviving. Separately,
  `rollback-gaps.json` killed 2 of 2 with its control surviving. Both ran over
  47 focused files, and every swept file was byte-identical afterwards.
- **Two walls, measured by hand**:
  - With the correction's write flag removed alone, every case passes, because
    a correction always follows the look step's own flagged write. With it
    removed beside the look step's flag, 14 cases fail.
  - With the look step's `cssMoved` condition removed alone, every case passes,
    because an unmoved sheet names no rule. With it removed beside a
    whole-sheet list (the defect back), 6 cases fail.
  - Both are kept, and the reason is written in the code.
  - `rollback-gaps.json` drops R-1, the flag alone, and re-anchors R-3.
- The 47 focused files read 1,682 / 1,682. The full suite reads
  `7950 / 7948 / 0 / 2` locally: +16 against 7,934, which is 10 + 5 + 1 net
  new cases.
- **Unit CI** on `c084e5c5` (run 36213341827) reads `7950 / 7946 / 0 / 4`,
  with all 24 new or re-anchored cases passing by name.
- **Site build** on `c084e5c5` (run 36213341839, 24m39s, all twenty steps)
  has all twelve counts green: TAP 397, site-build 382, and the rest as
  recorded. The only annotations are the two known ones.
- **Item 3's evidence:**
  - `test/css-scope.test.mjs` goes from 5 to 9 cases. They cover the reproduced
    shapes, the formatting control with quoted values present, the
    equivalences CSS does not establish, and a property over 1,500 random
    sheets (3,470 selectors judged; 1,428 sheets carrying a quoted value).
  - `test/edit-failure-paths.test.mjs` goes from 39 to 47. The page judge reads
    an attribute selector against the value the page's own source carries.
  - **Red on the unfixed `933168ea`: 8 of 56**: the three new unit tests and
    the five route cases carrying the defect. The unit formatting control fails
    there only on its two empty-declaration lines, which the old key read as
    changed (the safe direction).
  - The 49 focused files read 1,728 / 1,728. The suite locally reads
    `7962 / 7960 / 0 / 2` (+12).
  - **Unit CI** on `991b9204` (run 36216866723) reads `7962 / 7958 / 0 / 4`,
    with all twelve new cases and the battery passing by name.
  - **Site build** on `991b9204` (run 36216866790, 22m42s, all twenty steps)
    has all twelve counts green (TAP 397, site-build 382, and the rest as
    recorded) and only the two known annotations.
  - There was no mutation sweep, per the instruction; the red run is the
    evidence the cases bite.
- **Checked by shape only**: the add-on route's schema-refusal sentence when
  the revert is refused too. The add-on's compile arm is driven. But no harness
  makes the add-on's database apply refuse, and that arm's plain sentence has
  only ever been asserted by shape (`site-migrations`); the new variant is
  asserted the same way.

**Found on the way, not changed:**
- Beside an unchanged look, the menu change is not named in the reply; it reads
  only "The requested styling was already in place." This is the look branch's
  recorded limitation (review #9).
- The look step's own rollback block after `publishStep` is unreachable,
  because `publishStep` defers and always answers ok. Its guard in `site-apply`
  pins it.
- **The walker does not honour a backslash-escaped quote, and a rule after one
  is invisible to both readers.** `.q{content:"\""} header button{color:red}`
  gives `plainSelectors` `[".q"]`, so a broken rule written after such a
  declaration is never judged. The build service's own selection is blind the
  same way. Pre-existing, and not introduced by scoping. Fixing it changes what
  every build judges, which is beyond the key.
- After a correction that restores the sheet the site had, the screen still
  says "✅ Updated the look — the design. …" and names no menu change. The
  reply is composed from the lane's first answer (review #9's class).
- The check reads a rule's own selector, never an `@scope` root or another
  condition.

**The press that would confirm deploy 2160 at runtime — free, and yours.** The
form shows each box's description:
- <https://github.com/canias7/isibi-app/actions/workflows/edit-canary.yml>, run
  from `main`.
- "Run the ONE paid edit as well": `no`.
- "Refuse to spend unless the Worker reports this deploy sha":
  `7384ddbac4ba05b7251c52aa53d6fc9e018a9699`.
- "Refuse to spend unless a cold container reports this image id":
  `c3cc126e45e93815`.
- Every other box at its default.

## The consolidated milestone (2026-09-25, late) — merged and deployed at `7384ddba` (2026-09-26)

The owner asked for one batch across six areas. Each item below is marked
**demonstrated**, **reproduced defect** (now fixed), **unverified** or
**deferred**. The batch was reviewed at `4f6ab55c` and merged and deployed with
the rollback round at `7384ddba` (deploy 2160). Every model answer in the
evidence is supplied, so the tests prove what the route and the browser do with
an answer, never that a real model gives it.

### 1. Target selection

| Item | Status | Evidence |
| --- | --- | --- |
| A quoted or unreadable page after "on" dropped out unread (`d6f5e55e`) | reproduced defect, fixed | Independent review: 188 focused tests, both CI checks green. |
| "Remove the ‘Chords’ section on the menu" removed it from `/` on a site with `/menu` | reproduced defect, fixed (`01222bab`) | The guard reads the site's own page names: each page's last address segment and every label its own menu links with. 13 cases, red 6 of 201 on the parent. Probes `page-names.json`: 18 killed, 2 controls. |
| An unknown or shared page name authorising another page | demonstrated | A name two pages share names neither; words that name no page on the site ("at the top") keep their meaning. |
| Quoted replacement text kept as data; collateral-removal controls | demonstrated | The existing `edit-page-keep` controls pass unchanged. |

### 2. Failure and billing paths

| Item | Status | Evidence |
| --- | --- | --- |
| A routing answer that cannot be acted on dropped the message's words and files | reproduced defect, fixed (`9e70f093`) | `lost()` holds them on the site they came from. 9 cases red on the parent; the 33 stop cases in `site-route-failure` now assert the hold. |
| Unintended paid reconstruction from an edit or add-on escalation | demonstrated, no new defect | `EDIT_FAILURES` census, the add-on correction (`5cb8592`), and reply validation on both readers. Ordinary add-on failures stop with a sentence; the add-on route asks for a rebuild only when saved state is verified missing (the conditions are listed below this table). |
| A stopped edit's unpublished design was shipped by the next edit | reproduced defect, fixed (`324bc47a`) | Cancel, correction still missing, no time left: the design is put back. 3 of 4 red on the parent. |
| The logo rung read bare strings, not the composer's `{name, data}` | reproduced defect, fixed (`51e39e3c`) | 4 of 5 red on the parent. |
| Refusal and partial wording: the routing charge, the charged refused step, "nothing was charged" | reproduced defect, fixed (`908c12ee`) | Server sentences say what happened; the browser states the edit's cost from the reply and the routing call's from the routing reply. A finished job's cost comes from its own row. A refused step's charge is on its entry and said beside the change that shipped. 8 of 15 red on the parent. Probes `edit-money.json`: 17 killed, 2 controls. |
| An unknown outcome sent the customer to the preview, which cannot show a data or rules change | reproduced defect, fixed (`a3efddef`) | It now says asking again could make the change twice. Red on the parent over four layers and three unknown shapes. |
| A change that went through before a failed publish was called untouched | reproduced defect, fixed (`90efa38d`) | A new address, a table rule and a saved row are named ("Part of it did go through, though: …"). 6 of 7 red on the parent, the control green on both. Probes `landed-changes.json`: 11 killed, 1 control. |

**When the add-on route may ask for a rebuild.** A no-layer escalate from the
add-on route is the only add-on answer the browser turns into the full
rewrite, and the route produces one in exactly one place: the
`reconstruct: true` call in `worker.js` (`addonFailure` ignores the flag for
every reason but `no-source` and `no-meta`). It is reached only when every one
of these holds, in this order; each earlier failure stops with its own
sentence instead:

1. The message is not empty, and the picked model's key is configured.
2. The editable-state check passes and the page read succeeds
   (`loadSiteSourceForEdit` with `checked: true`). A failed read or a failed
   recovery stops (`editable-state`, `no-source`).
3. The database state is readable (`siteBackendDetail` is not `unreadable`).
4. The strict config read succeeds and, when the site has a database, the
   schema read succeeds (`specForAddon`). The spec must be well formed: a
   `tables` list, each with a name and a columns list. Otherwise it stops
   (`no-meta`).
5. It is not a stylesheet with no saved look. That is existing design, and it
   stops (`no-look`).
6. The saved state is positively missing: the page list read back empty
   (`no-source`), or no saved look and no stylesheet (`no-meta`).
7. The build configuration is present: the site database, the service key and
   the model key. Otherwise it stops (`unconfigured`).
8. The remaining component files read back under a strict read. Otherwise it
   stops (`no-meta`).

Only then does it answer `{ok: false, escalate: true, reason}` with no layer.
The browser climbs on that shape alone (`readAddonReply`'s `climb`); a
malformed escalate stops. The one other hop is a photograph asked for alone,
which goes sideways to the picture layer as a single edit, not a rebuild.

### 3. Database context on full rewrites

| Item | Status | Evidence |
| --- | --- | --- |
| An `incomplete` site's revise gave the writer the frontend rules | reproduced defect, fixed (`80ce60f4`) | The four-state reader resolves and proves the database read-only; the writer gets the database rules and the stored digest. |
| An unreachable database was treated as no database | reproduced defect, fixed (`80ce60f4`) | The revise stops, refunded, with `backend-unreadable`. |
| A `ready` site's revise digest lacked the site's functions | reproduced defect, fixed (`80ce60f4`) | Tables, functions and outside connections merge by name, the request's own entry winning. |
| Nothing repairs or provisions | demonstrated | Every query is a read; no reference write and no provisioning call, asserted. 5 cases, red 4 of 5 on the parent. |
| The new stop also fired on a first build, right after its database was made | reproduced defect, fixed (`8f66dfb9`) | Found while recording `80ce60f4`: a first build with a supplied schema, provisioned, catalog read refused, stopped with the revise's sentence. The stop is now for a revise alone; a first build builds on the schema it just applied, as before. 1 case, red on `80ce60f4`. Probes `revise-backend.json`: 9 killed, 1 control. |

### 4. Free coverage across the edit paths

All controlled, all with supplied answers. **No coverage test was added
without a concrete gap, and none was found.**

- **A second message after success, refusal and failure:** `edit-lock` (25
  two-message cases), `edit-result-display`, and the next-edit checks in
  `edit-failure-paths`.
- **Photographs:** preserved, restored and refused (`withheld`) on both
  writers, with authorised removal kept: `edit-page-photos`,
  `edit-page-protect`.
- **Deliberate component modification:** `edit-page-context` ("one changed
  component leaves the other exactly as it was", rendered with React) and the
  `edit-page-contract` route cases. Live: runs 21 and 24 changed
  `day-space-lookup`.
- **Picture, data and rules edits:** `edit-failure` (the data rung on an
  `incomplete` site, a component's photograph), `edit-rules-backend`,
  `edit-page-once` (the picture step), and the landed-change cases.
- **Partial success and queued completion:** `edit-failure` (mixed and
  all-refused), `edit-page-once` and `edit-failure-paths` (both money paths),
  `edit-reply-validation` and `edit-lock` (queued).

**Unverified live:** the full writer with the text guard and the judge; a
second message from the same browser; photographs; a live add-on; the picture,
data and rules rungs.

### 5. Deferred and known limits

- #418 (phone-width hydration) stays open.
- **Build path money wording.** "You weren't charged", `BUSY_BUILD_MSG`,
  `GATED_BUILD_MSG`, `STALE_BUILD_MSG`, the build timeout and `NO_CONTAINER_MSG`
  do not mention the routing charge. "Your database is live" is also said on a
  site that has none.
- **Add-on money wording.** The add-on reader states no routing charge, and
  `lostPhotosMsg` still says "nothing was charged".
- **Two money policies.** The synchronous path keeps a failed publish's
  collections, while the job path refunds them. A job also refunds a rename,
  row or rule that landed before its publish failed. Both are now reported
  from the ledger.
- **Text-guard grammar limits.** A site page name used as an ordinary word after
  on/in/from reads as that page and fails closed. Trailing commentary voids a
  clause.
- **The two rollback edges: closed** (the next round, `edit-failure-paths`).
  - *The correction's write flag* was the only record of a write when the css
    lane answered the stylesheet unchanged beside a step that publishes, and a
    stale rule then started the correction round. **That shape was the
    stylesheet-scope defect, and it cannot be built any more** (fixed on the
    branch, see the top section). A correction now always follows the look
    step's own flagged write, so the flag is a second wall rather than the only
    one. Measured by hand: with the flag alone removed, every case passes; with
    it removed beside the look step's flag, 14 cases fail. The four cases that
    drove the old shape went with it. The direct path's corrected build refused
    by the store is still driven, with the old sheet put back and a next edit
    that does not ship the correction.
  - *The verify catch* cannot be reached by any failure the round can meet,
    because every operation inside it handles its own. Driven at each
    boundary: the correction's model call failing, its write refused, and the
    corrected build refused by the store and by the publish gate. Each lands
    on its own named outcome and puts the design back. With a marker in the
    catch, the whole suite (7,934 tests) reached it zero times. The catch
    stays as the defence against a defect in our own code.
- **A failed restore after a publish failure of ours was not said — fixed on
  the branch, not merged** (the top section). `compileMsg` answered a failure
  of ours (and a refused reservation) with its own sentence, which dropped the
  one carrying "the change is saved". Every arm now takes the restore's result.
- **The stylesheet check read the whole stored sheet, not this message's rules
  — fixed on the branch, not merged** (the top section). A rule left dead by an
  earlier change started the correction round on any later message that picked
  the css lane, and the correction rewrote a rule the customer never mentioned.
  A publish is now held only for the rules the request wrote.
- **A new cost.** A `ready` site whose tables cannot be recovered now has its
  revise refused, where before it was revised with the partial spec.
- Drafts last for the session only. The needs-review enqueue sentence is never
  shown.
- Real-model compliance is unproven throughout.

### 6. Live acceptance — Test 3, prepared and not dispatched (waiting for spending approval)

Run 32 stays closed. **The prerequisite is met**: this batch is merged and
deployed (see the deploy entry), so a dispatch from `main` carries the page-name
resolution, the quoted-page reader and the canary's after-read wait.

- **The request, pasted verbatim into the "What to change" box:**
  "Remove the ‘The first eight chords’ section from the home page." — 63
  characters, 67 bytes (curly quotes U+2018 and U+2019), sha256
  `48bdbf475e1718e6ceaab4fee3a9941d13477f719616d262216a87dcbf2be823`.
- **The press:** `edit-canary.yml`, run from `main`. The form shows each
  box's description rather than its name:
  - "Run the ONE paid edit as well": `yes`.
  - "What to change": the sentence above.
  - "The site to edit": `fretwork-1`. "A second site…": `washhouse-3`.
  - "READ ONE EXISTING JOB AND STOP" and "PUT ONE SAVED VERSION BACK": blank.
  - "Refuse to spend unless the Worker reports this deploy sha": `7384ddbac4ba05b7251c52aa53d6fc9e018a9699`.
  - "Refuse to spend unless a cold container reports this image id": `c3cc126e45e93815`.
- **These two values name the build deployed today.** If the rollback round's
  two fixes (top section) are merged before the press, both change: the sha to
  the merge's, and the image to the one that deploy builds (the fixes move
  image inputs; predicted `168a9f94d1e6783e` over the fix commit `c084e5c5`,
  and `1ee5606e09db1a67` over the rule-key correction `991b9204`, 187 inputs
  each). Read both off the deploy and the free press before pressing.
  Neither fix is on the expected path: one needs the css lane picked, the other
  a failure of ours whose restore also fails. Which rung the router picks is
  itself part of what Test 3 measures, so that is an expectation, not a
  promise.
- **The starting state:** live `01790360265159-n7mtnq`, read again at
  01:01:55Z on 2026-09-26, with the headings in run 32's order. The press's own
  before-read must equal these six stored bodies:
  - `index.tsx` `6bb1fb500f7df623`;
  - `prices.tsx` `0d2d72dee56a2a71`;
  - `gear.tsx` `d580389f971cdd31`;
  - `chord-diagram` `d0c20d52f91d69d2`;
  - `trial-booking-form` `4b66386c0ad46092`;
  - `day-space-lookup` `4b162037f67df545`.
- **What records which writer ran.** `routing.json` holds the router's intent,
  layer and page, and the page list it was given. `terminal.json` holds the
  stored reply whole, which tells the writers apart:
  - `tweak: true` means the quick writer published and the full writer did not
    run. The quick writer cannot drop words, so on this sentence that outcome
    would itself be a finding.
  - `tweak` absent with `usage` present on a published page edit means the
    full writer published; `usage` carries its model and tokens.
  - `tweakUsage` means a quick attempt was made first.
  - `keepUsage` means the preservation judge ran.
  - A refusal names its reason. `prose-preservation` (with `proseBlocked`) is
    the text guard, which is asked only of the full writer's answer.
    `withheld` (with `contentBlocked`) is the judge refusing item by item.
    `contentUnchecked` means the judge failed.

  Full-writer coverage is claimed only when `tweak` is absent and the full
  writer's `usage` is on the reply.
- **Acceptance.** Each item is read from the evidence bundle and a real browser:
  1. **It counts as the test** only if the request sha matches, the press's
     own before-read equals the six bodies, the preflight passes with both
     expectations, and a stored terminal reply arrived.
  2. **Published at the job's own version.** The stored 200 arrives under
     `x-gf-edit: final`, and `x-site-version` moves to a version minted inside
     the run's window. `compare.json` says VERIFIED, with every after-page read
     at that version.
  3. **The requested removal, in the stored source.** `index.tsx` loses the
     section headed "The first eight chords", with its `ChordDiagram` grid. The
     `ChordDiagram` import and the `CHORDS` data serve only that block, so
     either may go too; that is noted, not failed. Every other top-level render
     block and the code above the render stay byte-identical.
  4. **Other pages and component bodies:** the other five files stay
     byte-identical. The `chord-diagram` file stays stored even though no page
     renders it: nothing deletes a component file.
  5. **The live page at that version.** The headings read, in order: Book a
     guitar lesson · A guitar you can turn · September 2026 · Space on a
     preferred day · Book a trial lesson · Book a trial lesson. There are no
     chord diagrams, the guitar canvas draws, and the day box answers the real
     `bookings_on_day`. `/prices` and `/gear` keep their headings and word
     lists. Console errors and failed requests are counted.
  6. **Money.** The balance moves by exactly the routing charge plus the edit's
     cost, and the edit's cost matches the ledger rows for its job.
  7. **The reply the customer sees** (`customer-reply.txt`) is checked against
     the bundle. The render check's #418 finding is passed on, not verified.
- **Cost:** about 18–27 credits, an estimate and not a cap. That is the
  routing charge (2), the full writer (~12–15, as in runs 21, 24 and 26), a
  quick attempt (from under 1 when it declines at once up to ~6 when it
  rewrites the page first, as in run 24), and the judge (~1). The balance was
  91 at run 32's end; the free press prints the current figure.
- **Reversible for free** with the restore mode (`01790360265159-n7mtnq`).
- **Limits:** one sentence on one site, and the writer's prompt is not
  captured. A text-guard refusal names no text and the refused answer is not
  stored, so a refusal cannot be blamed on the model. A publish is checked
  against the stored bodies and the live page, never taken as proof of
  preservation.

### Required CI

- **Unit:** run 36206886612 on `7384ddba` reads `7934 / 7930 / 0 / 4`. The
  seven new rollback cases and the kept control pass by name, with 7,934
  distinct result numbers and no `not ok`. Locally the suite reads
  `7934 / 7932 / 0 / 2`, and the 25 test files the milestone touched read
  1,002 / 1,002. The reviewed product tip `8f66dfb9` read `7927 / 7923 / 0 / 4`
  (run 36202704161).
- **Site build:** runs 36200973701 (`90efa38d`), 36201665364 (`80ce60f4`) and
  36202704088 (`8f66dfb9`). Each has all twelve counts green (TAP 397,
  site-build 382, and the rest as recorded) and only the two known
  annotations. The rollback round changed no file on the site build's paths,
  so the product tree it merged is `8f66dfb9`'s.

### Merged and deployed (2026-09-26)

Main was fast-forwarded `c2fa000c` → `7384ddba` (21 commits), which deployed as
deploy 2160 (run 36207057160, success, 01:02:52 → 01:05:53Z):
- The Worker reports `DEPLOY_ID` `7384ddba…`.
- The image was built as predicted, `c3cc126e45e93815` (187 inputs), and
  rolled over from `a51d8b32e5869576`.
- The served `chat.js` (786,047 bytes) and `edit-poll.js` (29,659 bytes) are
  byte-identical to the merged files.
- The rollback was verified before the push: it restores main's own tree.

A green deploy is Wrangler reporting on itself. **The runtime confirmation is
the free canary press** with both expectations set. The session's own dispatch
was re-tested at 01:22Z, once the image rollout had settled, and answered 403
again, so the press is yours:
- `edit-canary.yml`, run from `main`.
- "Run the ONE paid edit as well": `no`.
- "Refuse to spend unless the Worker reports this deploy sha":
  `7384ddbac4ba05b7251c52aa53d6fc9e018a9699`.
- "Refuse to spend unless a cold container reports this image id":
  `c3cc126e45e93815`.
- Every other box at its default.

The same press takes the before-read Test 3 starts from.

### Stopping point

The batch is merged and deployed (deploy 2160). **Its runtime confirmation is
pending**: the session's dispatch was refused (403), so the free press above is
yours, and nothing here claims the preflight passed. The rollback round's two
findings are fixed on the branch for review, not merged (the top section).
Test 3 is prepared above and waits for your spending approval. Nothing that
spends is dispatched.

## Status after run 32 (2026-09-25)

*Superseded by the milestone section above. Its "still open" items for the
billing sentences, the charged refused step, the full revise on `incomplete`
sites, dropped attachments and the "Check the preview" wording are now fixed on
the branch.*

**Closed since this record was written.** Each of these is merged, deployed and
live:
- queued refusal redraw escape;
- preview invalidation after a synchronous scheduling exception;
- the queued one-hop marker (all three by the edit-path milestone, deploy
  2158);
- literal-text loss on the full page writer, for parsed literal JSX prose and
  its request grammar (deploy 2158);
- the credit-refusal wording that states the edit charge and the routing charge
  apart (deploy 2159, runtime-confirmed by run 32's preflight).

**Shown live.** Run 32 (canary 36172189711): one real-model edit through the
quick writer. The edit moved a section on fretwork-1 and kept the surrounding
source byte for byte. Routing, the queue, the publish, billing (route 2 + edit 8
against a single reserve) and the reply are all confirmed. A real Chromium,
rendering TLS-verified live bytes, confirmed the order, the 3D guitar and the
availability box against the real `bookings_on_day` (1 → "5 places left.",
0 → "Six places left.").

**Still not shown live.**
- The full page writer on this deployment, with the text guard and the judge
  in `keepCheck`.
- A second message from the same browser.
- Photographs.
- A live add-on, and the picture, data and rules rungs.

**Still open.**
- #418 (phone-width hydration).
- The text guard's scope limits. The two ordinary page-qualified phrasings it
  refused with a correct answer are fixed on the branch (`ce913d06` + `8c0d67a1`), not
  merged. So is the bypass where a quoted or unreadable page after "on" dropped
  out unread (`d6f5e55e`). See [text preservation](edit-text-preservation.md).
- Next-task 4's other billing sentences and the charged refused step.
- The full revise on `incomplete` sites.
- Attachments dropped by an unusable routing answer.
- The add-on route's no-layer climbs.
- The "Check the preview" wording on an unknown outcome.

**Harness.** The canary's early after-read is fixed on
`claude/help-needed-ehlwlj` (`72885ca9`, not merged).

**Next.** Test 3 is revised and not dispatched: "Remove the ‘The first eight
chords’ section from the home page.", after `ce913d06` + `8c0d67a1` + `d6f5e55e` are merged and deployed,
about 17–25 credits. A publish is read against the actual stored output and the
live page; a refusal is read by its reason, which for the text guard does not
say which text.

---

Historical closure record. The subsequent owner-authorized [full edit-path
review](edit-path-milestone.md) records the queued marker, refusal-display and
preview-ordering corrections on the review branch. Closed deployments below
remain closed; they were not rechecked.

Scope: current product at `5cb8592`, the recorded reviews and canary 28. This is
not a new lane audit. Escalation correction and deployment verification are
closed; no further deployment checks, retries or paid runs are requested.

## Demonstrated behavior (with the evidence boundary)

| Behavior | Evidence |
| --- | --- |
| Correct Worker/container identity, async and runner flags | Live non-spending canary 36096052737, 2026-09-25 04:50:36 UTC: `5cb8592661ff`, `b83b0611aeecce8f`, both flags true. Balance 3. |
| Empty edit queues and reaches its stored terminal refusal; forged replay and unknown-job poll are rejected | Same live canary. This did not call a model or demonstrate a content edit. |
| Failed/unreadable add-on state and unusable answers stop; verified absence alone permits reconstruction; photo handoff and successful additions remain | Actual Worker responses through direct and queued browser handlers with stubbed providers: `test/addon-failure.test.mjs`, `test/addon-route.test.mjs`. Independent review and required CI green. |
| Untrusted edit/add-on replies cannot authorize success or another operation | `readRouteReply`, `readEditReply`, `readAddonReply`; controlled reply tests in `test/edit-reply-validation.test.mjs`, `test/addon-failure.test.mjs`. |
| Ask lock survives handoffs, releases once, blocks duplicate presses; old completions do not unlock newer requests | `siteEdit`, `editAsk`, `editAskDone`; `test/edit-lock.test.mjs`. Previously corrected, not reopened. |
| Edit-side result-display failure preserves known success and permits a next message | `applyEditResult`; `test/edit-result-display.test.mjs`, including credit-scheduling and redraw fault injection. Previously corrected, not reopened. |
| Served browser code matches reviewed code | Recorded byte comparison of live `chat.js`. Draft isolation, routing and preservation behavior also have controlled tests; those tests do not prove every real model response. |

## Implemented, but not established by this live verification

- A nonempty model-backed edit/addition through the real browser, queue, model,
  compiler, publish and result-display chain on this deployment.
- Its exact requested change, preservation of unrelated content/behavior,
  visible preview, truthful partial-result wording and per-operation billing.
- Live reconstruction and photo handoff with real providers. Controlled tests
  cover their decisions; the empty-edit canary does not exercise them.

These are missing observations, **not product defects**. Do not repeat completed
deployment checks or spend credits merely to relabel the same evidence.

## Known remaining defects and limits

| Item | Current-code evidence and precise scope |
| --- | --- |
| Add-on known-success fallback redraw — CLOSED, deployed at a5741864 | The owner independently reproduced an escaped queued display error; publication and request cleanup succeeded. The fallback now uses the existing edit-side guarded finish. Focused regressions cover direct/queued double failures, the subsequent message and a newer request started during redraw. Ordinary success-redraw controls remain. |
| Queued refusal redraw can escape | `watchEditJob` invokes the outcome reader from its async step; refusal branches call `finish` without containing a redraw exception. Recorded impact: the sentence remains and the request frees, but a rejection can escape. No new live incident is claimed. |
| Preview invalidation can be skipped after a synchronous scheduling exception | `applyEditResult` and `applyAddonResult` call `scheduleCreditRefresh()` before incrementing `previewV`. The injected synchronous throw is recorded. **Do not describe this as every failed balance request:** the actual scheduler defers `fetchCredits` in a timer, so an ordinary later network failure does not establish this sequence. |
| Queued handoff loses the one-hop marker | `watchEditJob` supplies `handedOff:false` to its reader, whereas `escalatedEdit` uses that flag for the hop limit. Latent guard gap: the recorded current data→text and picture→page destinations do not hop again. Not evidence of a current live loop. |

Drafts surviving site switches but not browser reload are an intentional
in-memory limit (`siteDraft`, `sitesSave`), not a newly found defect. The silent
duplicate latch is likewise a deliberate secondary guard, not a stranded-request
regression. Translation and model-written replies remain parked.

## Fallback-display correction closed

The owner independently reproduced the queued add-on double display failure.
The regression also failed before the patch with “the redraw failed” escaping.
The existing edit-side guard now contains that fallback redraw exception.

All 179 focused tests pass in edit-result-display, edit-lock and addon-failure:
one truthful success, no rewrite or extra handoff, busy/lock released, subsequent
message completes, and an older completion leaves a newer request alone.
The harness reads normalize CRLF so these controls also run on Windows.

This is an escaped display error, not a failed publication or stranded request.
Independent review accepted the patch and all 179 focused tests. Required unit
CI [36098613431](https://github.com/canias7/isibi-app/actions/runs/36098613431)
passed (7,710 passed, zero failures). Site-build was not required for these paths.

Merged by fast-forward from unchanged main at 41abeaa5 to a5741864.
[Deployment 2157](https://github.com/canias7/isibi-app/actions/runs/36099179983)
succeeded on 2026-09-25 at 05:35:53 UTC, deploying reviewed commit
`a57418643340b67f9d51210c903dbe18e1e532f3`. The deployment log reports the
existing SiteBuildContainer image reused; this is deployment-log evidence, not
a new runtime container observation. No container check or canary was run.

At 05:36:30 UTC, both https://gofarther.dev/chat.js and its cache-busted URL
returned HTTP 200 and were byte-identical to the reviewed git blob: 781,511 bytes,
SHA-256 `d873ddb00e7375f7b9ace05ad92954eb4947f8d98802ff45b5bbff14e34a2c36`.
This verifies the served correction. No paid run. Other checklist items remain
separate and unchanged; no next sweep or additional correction is started.
