# Full-page edit: literal prose preservation

Base: independently reviewed `9e58efc8`. Branch: `codex/edit-text-preservation`.
The prior corrections remain isolated on `codex/edit-path-milestone`. No merge,
deployment, paid request, live data mutation or demo repair.

## Cause and correction

The confirmed hero edit removed Opening hours because page-keep inventories
links and local component uses, not ordinary text. The full page writer's final
accepted source reached compilation and storage without a text comparison.
The router targets a page; it provides no trustworthy section authorization.
The existing tweak parser supplies a real TypeScript AST in the edit runtime.
No persisted section IDs or generator/tool schema change is needed for this
bounded correction.

`builder/page-prose.mjs` runs on the full EDIT page writer after the existing
photo and link/component protections, before `publishStep`. Build, addon and
quick-tweak paths retain their separate existing rules. The comparison uses
this rung's actual before source and the final photo-guarded output, so earlier
successful steps remain the baseline.

- Parse literal JSX text and braced string literals; assign each to its nearest
  native section/article, or the page's unscoped pool. Comments cannot contribute.
- Pair whole identical prose blocks first, independently of order. Unique source
  anchors or headings can locate changed blocks; neither establishes that their
  contents survived. Compare the exact normalized text identities within each
  pair. A unique unchanged body can pair a renamed heading. Duplicate text in
  another section cannot pay for a local loss.
- Keep the parsed function/conditional context, and explicit hidden/style
  attributes with each identity. Copying words into a comment, unused function
  or false conditional branch does not establish preservation.
- A small deterministic request grammar authorizes changes in uniquely named
  targets. It excludes replacement wording from target selection, handles
  heading/paragraph granularity, and does not interpret a link/photo/form's
  surrounding section as permission to rewrite its prose. A non-deletion
  request requires a surviving target with replacement prose. Explicit keep/leave
  clauses override grants, including conflicts with a removal request. Explicit removal
  and the existing all-sections-except-one control remain possible.
- When targeting or parsing cannot be established, return `409 prose-preservation` with an
  explanatory sentence. No rewrite/handoff is initiated and no extra model
  call was added. Existing model link/component verdicts cannot override it.

The distinct error reason avoids the legacy `withheld` browser suffix claiming
that nothing on the site changed. The refusal says this page change was not published; it does not promise the
entire request was free or untouched. Routing can have cost credits; a previous
successful step or editable-state recovery can have changed state.

## Route and rendering evidence

All outputs are supplied fixtures. The actual Worker edit route, sync and queued
job consumer, compiler capture, storage, billing protocol and real browser reply
composer are exercised. The compiler fixture echoes payloads; required site-build
CI separately performs real compilation/browser integration.

| Scenario | Observed result |
| --- | --- |
| Requested hero line change plus unrelated hours deletion | 409; no compile, page write, debit, reservation or browser handoff/rewrite |
| Hours body disappears under its unchanged heading | Same refusal; heading equality cannot conceal lost prose |
| Hours rewording and heading rename, neighbors unchanged | Accepted; exact output compiled/stored; rendered replacement list, neighboring form/links retained |
| Section movement | Accepted in sync/job; rendered order changes with old words retained |
| Explicit text-only section deletion | Accepted; only requested section disappears from rendered output |
| Explicit keep conflicts with rewrite/removal | Refused; preservation wins over the surrounding change grant |
| Duplicate headings / vague / negated target | Refused; unique section ID or exact quoted text is a supported disambiguation |
| Reword request answered by deleting the section | Refused |
| Hero replacement text mentions Opening hours | Does not authorize editing/removing the hours section |
| Repeated body sentence in another section | Cannot mask local loss; explicit deletion still retains the other instance |
| Style succeeds and page loses text | Style alone compiles/stores and is charged; browser reports partial refusal honestly |
| Links, custom form and photograph beside ordinary text | Accepted wording keeps them in compiled/stored output and rendered markup |
| Missing parser / malformed source | Refusal, not an empty inventory or reconstruction |
| Old text copied into comments, unused function or false branch | Refused |

A local browser displayed React-rendered HTML captured from the actual accepted
route's stored output: When we open, the new weekday/Saturday list, unchanged
Harbour Loaf copy, Order ahead form and Find us link/address. This is isolated
fixture rendering, not a deployed site's complete theme or working backend.

Initial unit CI caught the new module missing from the explicit container COPY
list. Added it beside page-keep and retained the import-closure check. The earlier
site-build run was superseded after that correction.

Focused validation: **563 passed, zero failed** across edit-page-keep/context/
protect/photos/once/contract/target/verb/rpc-state, edit-path, edit-lock,
edit-result-display, edit-poll, addon-failure, edit-failure, addon-queue and
site-busy. Required CI results and exact commit are recorded in the delivery
report and attached GitHub workflow history; deployment checks are not repeated.

Several old fixtures used unrelated business-name/paragraph changes as writer
markers. Those outputs now preserve the name or use explicit hours headings and
requests. Their payload, storage, photo restoration, component withholding and
billing assertions remain. The conditional-swap control now preserves its
correct loading branch in the supplied full-writer answer; its negative check
names the actual swapped arm, not every occurrence of the conditional. Relevant
Windows fixture reads normalize CRLF. These changes do not prove model compliance.

## Limits and compatibility

This is a conservative guard for literal JSX prose, not a universal proof of
rendered content or intent. It does not inventory words generated from arbitrary
JavaScript/data, component prop strings, remote data or CSS pseudo-content, and
it does not analyze component files recursively. Existing component/file/photo
protections remain in force. It cannot prove arbitrary CSS/layout visibility,
function reachability or behavioral equivalence. The context checks reject the
specific hidden/unused variants above, not every equivalent disguise.

Target recognition is intentionally narrower than general natural language:
explicit English action clauses with an exact unique heading/ID, or exact text.
Vague shorthand, paraphrases, complex exceptions, inline-markup splits, whole
layout restructuring, and simultaneous renaming/rewording with no matchable
anchor can be refused even when legitimate. No model assurance overrides that
uncertainty. A runtime without the existing TypeScript parser refuses full-page
changes; it does not silently disable the guard or buy reconstruction.

Within an explicitly authorized section, this guard does not prove the new
wording is correct. A supplied writer answer is never evidence that a live model
will follow the request. A function renamed on the way past can also cause a
conservative refusal. No architecture migration or new permissions are required
for the current patch. Broader computed-content/semantic targeting remains a
separate decision rather than an implied guarantee.

## Readiness

The confirmed ordinary-text loss is closed for the documented parsed scope,
with acceptance and refusal evidence through real routes. This candidate is
ready for independent review when required CI is green. Universal unattended
preservation is still not established: computed/rendered content and unrestricted
natural-language targeting exceed this bounded guard. No paid test is needed to
reproduce or verify this correction. Translation, video hosting and model-written
customer replies remain parked.

## Authorization correction after independent review

Review of `eb275910` reproduced an authorization bypass: substring matching
considered both Opening hours and Weekend hours targets in “Remove the Opening
hours section above Weekend hours.” Supplied deletion of both compiled/stored
and the browser reported success. The parsed comparison itself correctly found
lost prose; permissions incorrectly excused it.

The correction retains the comparison and replaces mention matching with complete
noun-phrase resolution. Supported grammar is an explicit operation followed by
one exact section name/ID (optionally `section`, `heading` or `title`), an explicit
`and` target list, or separate operation clauses. Line/paragraph/sentence under,
in or of a named section retains narrower scope. A finite set of reference/result
introducers ends the target operand: to/as/into/with/so that, above/below/before/
after/beside, like/compared to/relative to, at/on/off. Text beyond that boundary
never contributes another target. This is a conservative grammar boundary, not
an interpretation of arbitrary modifiers or a positional disambiguation engine.
Unknown noun phrases, `or`, vague references and duplicate headings grant nothing;
an existing unique section ID disambiguates duplicates. Movement preserving prose
needs no loss permission. Explicit target lists and separate operations remain
supported. Existing keep constraints and group-except constraints override grants.
Quoted text is shielded before command splitting and operand parsing; embedded
section names, punctuation and commands cannot acquire authority. Unbalanced
quotation syntax refuses authorization. Tokens cannot collide with request text.

Before/after evidence: running the first new matrix against the original module
produced eight failures: positional-reference collateral deletion, commands inside
quoted replacement copy, and unsupported `near`/`or` targeting, in both execution
modes. After correction, 617 focused tests pass, including the prior 563 controls.
The added matrix exercises real direct and queued routes, compile/store capture
and the actual browser reply composer. Intended deletion, rewrite, heading rename,
movement, two targets, two operations and explicit ID disambiguation return 200,
compile/store exactly the supplied output, and say Updated. Collateral loss returns
409, compiles nothing, retains stored source and returns the explanatory refusal
with no handoff/rewrite actions or reservation. Keep/except conflicts and malformed
quotes stop. Comparison includes collateral rewording, not just section removal.

These are supplied-writer plumbing tests, not evidence of live model compliance.
The compiler is captured in these route tests; required site-build CI remains the
real compilation check. Existing parsed-prose/rendering limits above still apply.
No new UI or rendering behavior was introduced. Reference phrases are not used to
resolve duplicate headings; an exact unique identifier is required. Unsupported
legitimate phrasing may conservatively refuse a text-changing output. No broad
language-understanding claim, global IDs, extra provider calls or architecture
change. Required CI links for the final SHA are recorded in the delivery report.

## Page-qualified requests (2026-09-25, owner)

The owner reproduced two ordinary sentences refused with a correct generated
answer: “Remove the ‘The first eight chords’ section from the home page.” and
“On the home page, change the text under ‘The first eight chords’ to ‘Start
here.’” The guard read the page qualifier as part of the target, so the target
matched nothing; the second also used “the text under”, which was not a form.

- **A page qualifier is read as a page, and it must be the page being edited.**
  `preservePageProse` takes `page`; the edit route passes the target's route.
  A qualifier is a preposition (on, in, from, off, of, for, at) plus a page
  name: the home page (or homepage, front, main, landing, index page), an
  address (`/menu`), or “the menu page” (the page whose address ends in
  `/menu`). “This page” and “the page” can only mean the page being edited.
- **Every qualifier in a clause must match, or the clause grants nothing.** A
  qualifier naming another page, or any named page when the page is unknown,
  grants nothing. A qualifier can therefore only narrow what a sentence
  authorizes.
- **A qualifier is never a target.** A leading “On the home page,” is taken off
  in front of the verb, and qualifiers are taken out of the operand before the
  target is read. Text after them is still a reference or a result, never a
  second target. “From” is not a general boundary: “from ‘A guitar you can
  turn’” is not a page, so it grants nothing.
- **“The text under X” (and “words under/in/of X”) has the paragraph's exact
  scope**: one paragraph under the heading, or no grant at all.
- **The quoted-text form ignores a trailing qualifier** when it reads the
  replacement.
- **“To” is not a page word.** It already ends the target operand, and a page
  after it is a destination or replacement wording (“…then go to the gear
  page”). Reading it as a qualifier could only refuse a valid request.

Evidence (supplied writer answers only):
- `test/edit-page-keep.test.mjs` gains 23 cases (the “to” wording is an extra
  assertion in the matcher case). 22 go through the real edit
  route in sync and job modes, with compile/store capture and the browser
  composer, and one drives the matcher directly.
  - These publish: the owner's two sentences, a reference after a qualifier,
    and quoted text with a qualifier.
  - These refuse, all on `prose-preservation` / `unconfirmed-target` with
    nothing compiled, stored or reserved: unrelated text lost beside either
    sentence, the heading renamed beside the change, a qualifier naming another
    page (trailing and leading), a referenced section dropped too, and “from” a
    section.
- Red on the unfixed guard: exactly the six publish cases and the matcher case
  fail; every refusal control and all 156 existing cases pass on both.
- Targeted probes: 14 killed, 0 survived, 2 comment-only controls. The first
  run's survivor was a real gap (an address was recognised but not compared),
  closed by a negative case.
- Checked separately against fretwork-1's stored home page (17 cases, local
  only): the same outcomes.

Limits: the page names recognised are the ones above. A page called by its
navigation label (“the Lesson Prices page”) is not confirmed and grants
nothing. Unquoted replacement text that names another page makes its clause
grant nothing. These are conservative refusals, never wider grants. Nothing
here proves a real model's answer.
