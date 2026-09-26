# Remaining edit-path checklist

## Remaining work after Test 3 (2026-09-26), and Test 4 prepared for approval

Test 3 (run 34) and the CSS-correction milestone (deploy 2161's batch) are
**closed by the owner**: no repeat run, no restoration, no further CSS work.
Main is `0de188ff` (deploy 2161, image `05750a5120d33570`), runtime-confirmed
by run 33. Nothing has been dispatched since run 34, and the balance is 73.

### What is already shown live (credited, not rerun)

A read-only census of `edit_jobs` (2026-09-26, 07:40Z) lists every edit the
queue has ever published: **51 jobs since 2026-09-01**. All of them are on
fretwork-1 except one on fold-lane-bakery (run 9).

| Rung or behaviour | Published live |
| --- | --- |
| Page rung, quick writer | Runs 9, 17 and 32 (a block move, a one-line change, a section move); lane-sweep jobs on 2026-09-02 (shape, three). Run 9 kept both photographs, checked in a real browser. |
| Page rung, full writer | Runs 11, 21, 24, 26 and 34 (34 on the current code, with the text guard and the judge); lane-sweep jobs on 2026-09-01/02 (three, components, purpose, tsx twice). |
| Look lanes | 32 jobs, 2026-09-01 to 09-07: css, brand, favicon, lang, langs, theme, description, wordmark, qr and behavior. One also placed a QR code through the page rung, the only live message that ran two rungs. |
| Menu | 2 jobs (the action lane), 2026-09-02. |
| Site address | 1 published and 1 refused and refunded, 2026-09-02. |
| Text | 1 job (gap-sweep run 10), 2026-09-02. |
| Queue, billing, reply, after-read | Every canary run. Runs 33 and 34 ran on the current code. |

The jobs from 2026-09-01 to 09-07 ran on older code. They count as live
coverage of those rungs' paths, not as evidence about today's code, and they
are not rerun.

**Never published live:** the logo, picture, data and rules rungs, and a page
move or removal. **No job has ever been `exempt`**, so the free-rung path
(logo, page move or removal) has never published through the queue since
`ed1e3b93` fixed its gate. Every canary message is one request from a script,
so two messages have never come from one browser tab.

### Missing live evidence (not product defects)

Controlled tests cover each decision below, with supplied answers. What is
missing is a real model, the real browser or the live database.

1. **A second message in the same tab**, after a queued job, a hop or a
   failure. Controlled: `edit-lock`, `edit-result-display`,
   `edit-failure-paths`.
2. **An attachment sent from the real composer**, in the logo rung's
   `{name, data}` shape (fixed in `51e39e3c`). Controlled: `site-logo`,
   `edit-failure-paths`. The 2026-09-24 live check stopped the edit request in
   the page.
3. **The logo rung and a page move publishing through the queue** (the
   free-rung exemption). Controlled: `edit-queue`. `edit_exempt` was driven on
   the live database in a rolled-back transaction on 2026-09-02.
4. **The picture rung** (reframe, swap). Controlled: `site-picture`,
   `edit-page-once`, `edit-failure`.
5. **The data rung.** Controlled: `site-apply`, `edit-failure` (including an
   `incomplete` site).
6. **The rules rung on a site with a database.** Controlled:
   `edit-rules-backend`. Run 12 was blocked by a defect that has since been
   fixed.
7. **The full writer on a page with photographs.** Controlled:
   `edit-page-photos`, `edit-page-protect`. Live, only the quick writer has
   done this (run 9).
8. **The first schema change on a site built before 2026-09-13**, which
   re-emits every table's grants in column-scoped form. Proven on a real
   PostgreSQL 16 locally (`local-pg-grants`), but not observed on a live form
   submission.
9. **Real-model behaviour in general.** Why a quick attempt did not publish is
   not on the wire, and the writer's prompt is not captured.
10. **The add-on through the browser since deploy 2154.** This is outside this
    checklist; the last live add-on was run 53 (2026-09-20). Not proposed now.

### Reproduced product defects, still open

1. **New: the text guard cannot name a section whose heading comes from a kit
   component's prop.**
   - **The case.** 'Remove the "Today's bake" section from the home page.' was
     run on fold-lane-bakery's stored pages with a correct answer, with and
     without the unused imports cleaned up. It is refused: 409
     `prose-preservation`, `unconfirmed-target`, with nothing compiled or
     stored.
   - **Why.** A visitor sees "Today's bake" as the section's heading (an
     `<h2>`), but the source says `<SectionHeader title="Today's bake">`. The
     guard names a section only by literal `<h1>`–`<h6>` text or by a
     `<section>`'s id or aria-label. Its refusal then asks for "the section by
     its unique heading", which is exactly what the request gave.
   - **Reach, over the 324-page corpus.** 329 of the 555 sections that hold
     literal prose (59%) have no name the guard can read. On 86 of the 251
     pages with such sections, none of them has one.
   - **Impact.** It fails closed, so nothing is lost; the customer pays the
     routing charge for a refused message.
   - **Status.** Reproduced free through the real route with supplied answers.
     Not fixed: this is a product change that needs its own review.
2. **Review #9:** a multi-step look reply names only the look, even when a
   picture, menu or address change went through beside it.
3. **An add-only answer ends the whole message.** A QR code, a 3D element or
   an "add a page" in the look door stops everything, so an ordinary change in
   the same message never runs (next-task 5).
4. **A half-moved site address.** If the second alias write of an address
   change fails, the old name is demoted and the new one is never written
   (next-task 5).
5. **The reply shows three problems of N** with no "and N more" (run 11).
6. **The quick writer's reply carries empty `changed` and `moved` lists** (runs
   17, 32 and 34). They are not an inventory.

### Deliberately deferred (owner's decisions)

- Hydration (#418), translation (including page code read as text), and
  model-written replies.
- CSS: no further work, including the css lane dropping an earlier rule (#8)
  and a live css-lane run on deploy 2161's code.
- The full-site revise: no photograph wall, and `imageDirective(0)` on a
  photographed site.
- Money wording on the build path and in the add-on reader; the two refund
  policies; the routing charge, which is never refunded.
- Text-guard grammar limits (a site page name used as an ordinary word;
  trailing commentary).
- Drafts are session-only, and the needs-review sentence is never shown.
- The add-on route's no-layer climbs (the server-side classification).
- The photo add-on kind, which waits on fal funding.

### Free checks done for this assessment

- **The job census** above (read-only).
- **Live reads of fold-lane-bakery** (07:14–07:34Z):
  - it still serves run 9's version, `01789969693841-xqi8vs`;
  - its five routes' HTML was saved;
  - the public `loaves` route answers 200 with six rows (Sea Salt Focaccia
    4.5);
  - `orders` answers 403 to a visitor, which is the shape a refused read takes.
- **A rehearsal of Test 4 — 13 of 13 pass.** It ran through the real edit
  route of the deployed tree, on fold-lane-bakery's stored pages (run 9's
  after-read), on both money paths, with every model answer supplied:
  - the logo, which makes no model call, is exempted and passes the publish
    gate;
  - the picture reframe changes only `focus="top"`;
  - the page move rewrites every reference and publishes free;
  - the removal of a section made only of kit props reaches the full writer
    and keeps both photographs;
  - an answer that also drops a photograph is withheld;
  - the same removal, answered to a request naming a different section, is
    refused;
  - the new defect above reproduces.

  The rehearsal is scratch work and is not committed. The controlled tests
  already cover these decisions; this only pins them to this site's real
  pages.
- **The corpus heading census** behind defect 1.
- **Data and rules were not rehearsed.** The uncertainty there is the router,
  since an adopted site sends it no table names, and the live database. Only a
  live run measures those.

### Test 4 — prepared for approval, not dispatched

Everything runs on one site, fold-lane-bakery (Harbour Loaf). It has a
database, three photographs and five pages, so every remaining rung has
something to act on, and run 9 already read its stored source. There are three
parts, in order.

**Part A — your paid canary press: the full writer on a page with
photographs.**

- **The form.** `edit-canary.yml`, run from `main`:
  - "Run the ONE paid edit as well": `yes`.
  - "What to change": `Remove the "Order a loaf for collection" section from
    the home page.` That is 68 characters with straight quotes, sha256
    `54a55001238b9e2b84a10bca5a6af15c8a36b1e71b6c37a8ca227de16f242766`.
  - "The site to edit": `fold-lane-bakery`. "A second site…": `washhouse-3`.
  - "READ ONE EXISTING JOB AND STOP" and "PUT ONE SAVED VERSION BACK": blank.
  - "Refuse to spend unless the Worker reports this deploy sha":
    `0de188ff2d3a00d8096b01f8616c507aea2bbce4`.
  - "Refuse to spend unless a cold container reports this image id":
    `05750a5120d33570`.
- **Why this sentence.** The section is a `CtaBand` whose words are all props.
  The quick writer cannot remove it, because its words would change, and the
  text guard loses no literal prose. The page keeps two photographs, so the
  full writer rewrites a photographed page with the photograph wall live.
- **It counts as the test only if** the request sha matches; the press's own
  before-read equals these five bodies; the preflight passes; and a stored
  reply arrives. The bodies:
  - `index.tsx` `2c9421cf728d9823` (4,389 characters);
  - `order.tsx` `4491c50d7cee45d8`;
  - `the-starter.tsx` `e1172965a3644f5f`;
  - `visit.tsx` `0963e3bc45f1d949`;
  - `gallery.tsx` `1c940e38d7fe6ab0`;
  - no components.
- **Expected.**
  1. It is routed to the page rung for `/`, either directly or through `look`.
  2. The full writer publishes: `tweak` is absent, with `tweakUsage` and the
     full writer's `usage`.
  3. It publishes at the job's own version, and `compare.json` reads VERIFIED.
  4. `index.tsx` loses that one `<section>`. The unused `CtaBand` import may go
     too, which is noted, not failed. Both `<SafeImage>` elements and all the
     other code stay byte-identical, and so do the other four pages.
  5. There is no `keepUsage`, because no own component or literal link is
     lost, and `problems` is empty.
  6. The reply is "✅ Updated /.", with the render check's note passed on.
  7. The balance moves by the routing charge plus the edit, and the ledger's
     one reserve for the job equals the edit's cost.
  8. The live page, in a real Chromium:
     - its headings are Harbour Loaf · Fed every morning since we opened ·
       Today's bake;
     - both photographs load;
     - the bake list shows six loaves;
     - there are no console errors or failed requests.
- **What a different result would mean.**
  - `tweak: true`: the quick writer published a removal of words, which it
    must never do.
  - `prose-preservation`: a false refusal of a removal that loses no literal
    prose.
  - `withheld` with `photosBlocked`, or `photosKept`: the writer dropped a
    photograph and the wall refused or restored it. That is the protection
    working live, and a refusal publishes nothing.
  - A `problems` line naming `loaves`: the rung read the wrong schema, a
    lookup finding.
- **Cost:** route 2 + edit about 8–10, so about 10–12 (8–15). An estimate, not
  a cap.

**Part B — in the app, one tab, no reload: six messages.**

Open Harbour Loaf from the start screen. Send each message only after the
previous reply is on screen.

| # | Send exactly | Rung | Expected reply | Checked afterwards (free) | Credits |
| --- | --- | --- | --- | --- | --- |
| M1 | Attach a PNG or JPEG under 2 MB (not an SVG) with the + button, then `Use this picture as the logo.` | logo | "✅ That's your logo in the header now, on every page." | The header draws the image on every page. The job is `exempt`, cost 0. | 2 |
| M2 | `Show more of the top of the photo of the sourdough boule cooling.` | picture | "✅ Moved “A sourdough boule cooling after the morning bake” to show the top." | Only that image gains `object-top`, and both photographs still load. | ~3 |
| M3 | `In today's bake list, change the Sea Salt Focaccia's price to £4.60.` | data | "✅ Updated one entry in loaves." | The public `loaves` route shows 4.6 for Sea Salt Focaccia. No page changed. | ~3 |
| M4 | `Move the starter page to /starter.` | page (move) | "✅ Moved /the-starter to /starter." | `/starter` answers 200; `/the-starter` answers 301 to `/starter`; every link follows. The job is `exempt`, cost 0. | 2 (3 through look) |
| M5 | `Only let signed-in members see the list of loaves.` | rules | "✅ **loaves** — changed who can see it. It’s live now — nothing needed rebuilding." | The public `loaves` route answers 403, as `orders` does today, and a visitor sees "Couldn't load today's bake." | ~3 |
| M6 | `Let everyone see the list of loaves again, signed in or not.` | rules | The same shape | The route answers 200 with the six rows again. | ~3 |

- **Second messages.** Messages 2 to 6 each follow a finished job. Each must
  get its own job and reply, and the send box must come back after each. A
  message that is routed and then hangs means the per-ask latch has failed.
- **Routing is part of what M3 and M5 measure.** The router is sent the site's
  pages, but its table names only if this browser built the site.
  - M3 sent to `text` (a sentence, nothing changed) or to `page` (a price
    written into the page) is a routing finding.
  - M5 sent to `page` (a display gate while the data stays public, so the
    route still answers 200) is a wrong-layer finding.
- **Cost:** about 16–19 in total (14–26; about 26 if M3 goes to the page
  writer).

**Part C — your free canary press.** Use the same form as Part A, with "Run
the ONE paid edit as well" set to `no` and "What to change" left blank. It
reads every stored body after Part B, so the whole sitting is compared byte
for byte:
- `index.tsx` should change only by Part A's removal, M2's `focus="top"` and
  M4's links;
- `the-starter.tsx` should become `starter.tsx`;
- the other pages should change only by M4's links.

**Side effects, said before the press.**
- **Reversible for free.** Part A, M1, M2 and M4 publish new versions. The
  restore mode puts back `01789969693841-xqi8vs` for free, including the
  pages, the logo and the redirect.
- **Not undone by a restore.** M3 changes a row. To put it back, send "Change
  the Sea Salt Focaccia's price back to £4.50" (about 3 credits).
- **A short outage of the bake list.** Between M5 and M6, which is a minute or
  two, visitors see "Couldn't load today's bake."
- **The grant re-emission.** M5 is this site's first schema change since
  2026-09-13, so by design it re-emits every table's grants in column-scoped
  form.
  - The order form then relies on the stored schema declaring the five fields
    it sends: `customer_name`, `phone`, `loaf`, `pickup_date` and
    `pickup_time`.
  - No free check can confirm that, because a test order writes a row. One
    test order after M6 would confirm it — your call.

**Total:** about 26–31 credits (22–41), an estimate and not a cap. The balance
is 73.

**What Test 4 does not cover:** hydration, translation, model-written replies,
the add-on, a css-lane run, a page removal (the move exercises the same verb
and publish path), a hop between rungs, and why a quick attempt did not
publish.

## The two findings from the rollback round (2026-09-26), and the two rule-key defects found in their review — merged and deployed at `0de188ff` (deploy 2161); CLOSED by the owner 2026-09-26

After reviewing the merged batch, the owner asked for both findings to be
closed together before the paid Test 3. The work was to use focused tests and
required CI, and to come back for review before another merge or deployment.
The owner's review passed at `0de188ff` (288 focused tests), and the batch was
then merged and deployed as deploy 2161 (see *Merged and deployed at
`0de188ff`* below). Nothing that spends was dispatched. Every model answer in
the evidence is supplied, so the tests prove what the route and the browser do
with an answer, never what a real model answers. **Deploy 2161 is
runtime-confirmed** by your free canary, run 33 (see *Merged and deployed at
`0de188ff`*). The session's own attempt had answered 403.

| Item | Status | Evidence |
| --- | --- | --- |
| An old stylesheet rule that matched nothing held an unrelated edit, and the correction round rewrote the stylesheet nobody asked about | reproduced defect, fixed; deployed in 2161 | A publish is held only for the rules this request wrote. On the unfixed code the menu edit ran a correction and a second build, and the stored sheet was rewritten (each checked on its own). |
| A new rule that points at nothing is still held and corrected | demonstrated (both money paths) | The correction is asked about that rule alone, never the old one. The job's second publish checks the corrected rule, and the correction that lands is stored. |
| A container still on the previous image | demonstrated (job) | It judges every rule, and the route's own filter still holds the publish for the new rule alone. |
| A failure of ours whose restore was refused too said only "our build service was restarting", while the change stayed saved and the next edit shipped it | reproduced defect, fixed; deployed in 2161 | Every arm of the failed-publish sentence now says the change is still saved when the restore failed. Driven on both money paths, plus a gate refusal, a real compile failure and a cancel. |
| The add-on route logged a revert that failed and still called the site untouched | reproduced defect (the same class, one route over), fixed; deployed in 2161 | The reply now says the addition is still saved. |
| Review finding: the rule key collapsed whitespace inside quoted values, so a lane that respaced `[data-label="a  b"]` to one space shipped a selector matching nothing, unjudged | reproduced defect (both money paths), fixed; deployed in 2161 | The compiler was sent `cssVerify: []`, the job committed, and the screen said the look was updated. Now the respaced rule is sent to be judged, found dead against the page, and corrected (both paths), or refused when the correction still misses (job). |
| The same collapse on quoted declarations, quoted at-rule conditions, escapes and whitespace before a colon inside a selector | reproduced (unit), fixed; deployed in 2161 | Thirteen more pairs answered `[]` on the old module, each measured; each is now named. A quoted declaration and a quoted `@scope` root are also driven through the route. |
| The harmless formatting control | demonstrated, kept | A sheet answered back with only the whitespace CSS ignores is sent to be judged for nothing (both paths); also held over 1,500 random sheets carrying quoted values and escapes. ⚠ That property's generator was degenerate and barely formatted anything until item 4 (below). Made exact and re-measured, it still holds. |
| Second review finding: a comment read as whitespace. The key made `.a/**/.b` (the compound `.a.b`) and `.a .b` (a descendant) one rule, and `plainSelectors` handed the judge `.a    .b` for the first | reproduced defect (both money paths), fixed; deployed in 2161 | On `e49a370c` the lane's `.a .b` shipped with `cssVerify: []`, nothing judged, and "Updated the look". Now it is sent, found dead against the page and corrected (both paths), or refused (job). A new rule written with a comment is judged as the compound it is. |
| Which spelling reaches the page | demonstrated in a real Chromium | A browser control in the site build (`site-build.mjs`) establishes the fixture table the unit cases judge by. |
| Harmless formatting and a comment spelled another way | demonstrated, kept | A comment beside whitespace, a brace, a semicolon, a comma, a colon or a bracket names nothing; the same boundary spelled `/* x */` names nothing (both paths). |

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

**4. A comment is a token boundary, not whitespace** (the owner's second
review: *"Preserve selector meaning across both readers. Do not simply delete
every comment and concatenate tokens; that can change token boundaries. Keep
uncertain differences classified as changed."*).
- **Reproduced first**, on `e49a370c`, through the real edit route on both money
  paths. The page carries `<p className="a b">` and nothing inside it. The
  stored rule `.a/**/.b{…}` reaches it; the lane answered `.a .b{…}`, which
  reaches nothing. The compiler was sent `cssVerify: []`, nothing was judged,
  the sheet was stored and published, and the screen said "✅ Updated the look —
  the design. …".
- **Two readers, one cause.** CSS consumes a comment without producing
  whitespace, so `.a/**/.b` is the compound `.a.b`: a real Chromium serialises
  that rule as `.a.b` and applies it to the paragraph. The key read the comment
  as whitespace, so the two spellings were one rule. And `plainSelectors` cut
  its selectors from the comment-blanked copy, handing the judge `.a    .b` for
  the compound — a descendant, the wrong meaning. (It also blanked a
  comment-shaped attribute value, `[data-x="/* a */"]`, into spaces.)
- **Why not just delete comments.** A comment is not nothing everywhere: `a/**/b`
  is two tokens and `ab` one; so are `1/**/.5` and `1.5`.
- **The rule, shared by both readers:**
  - A comment touching whitespace, or at either end, is part of that whitespace.
  - A comment beside a delimiter no token merges across is nothing. The
    delimiters are `{ } ; , : [ ] )` on either side, plus `(` and `>` before
    the comment. `x(` would make a function, and `-->` the end of an HTML
    comment.
  - Any other comment is kept as a boundary, spelled `/**/`. So an uncertain
    difference (`.a/**/.b` against `.a.b`) reads as changed and is judged.
- **What the judge is handed.** Each selector is cut from the sheet's own text
  at the offsets the blanked copy gave. It is respelled only where a comment
  touched it, so a comment-free selector is byte-for-byte what it was.
- **During a roll, stated.** The build service spells the judged strings and
  the edit route names them, and the gate matches the two by equality. A job
  runs both halves in one container image. So only an edit that runs in the
  Worker, against a container still on the previous image, can leave a
  comment-bearing selector it changed unjudged, until the roll completes.
  Comment-free selectors are spelled identically by both versions.
- **Evidence:**
  - **Old against new `plainSelectors`**: 0 differences over 21,332
    comment-free inputs (4,440 with selectors). The inputs are the tests'
    literals, the theme registry and a fuzzer on an exact generator.
  - **The judged strings, audited in a real Chromium (run locally, not
    committed)**: 6,000 random selectors with comments placed at random
    (4,254 of them respelled). For every one, the browser's own parse and its
    `querySelectorAll` read the written selector and the judged string
    identically, or refuse both. The old reader fails the same audit on
    1,959 of the 6,000.
  - **Unit tests**: `test/css-scope.test.mjs` goes from 9 to 12 cases: the
    owner's pair and the fixture table; a comment CSS reads as nothing; and a
    comment beside what may merge, read as changed. The formatting property
    now also wraps every delimiter in a bare comment (49,134 comments, naming
    nothing).
  - **Route tests**: `test/edit-failure-paths.test.mjs` goes from 47 to 55
    cases, judged by the browser's table:
    - the rewritten rule is sent, found dead and corrected (both paths);
    - it is refused when the correction still misses (job), and the next edit
      ships the stored rule;
    - a new rule written with a comment is judged as the compound it is and
      ships with no correction (both paths);
    - formatting, and the same boundary spelled `/* x */`, send nothing (both
      paths).
  - **The browser control**: `test/integration/site-build.mjs` runs in the
    site-build workflow with a real Chromium. For every spelling in
    `test/fixtures/comment-boundary.mjs` it checks three things:
    - that the page's cascade applies the rule as written or does not;
    - that `plainSelectors` hands the judge the table's string;
    - that the page's own `querySelectorAll` agrees with the cascade.

    It then runs the real render check over the owner's pair, which reports
    `.a .b` dead and `.a/**/.b` alive.
  - Run locally: 22 of 22 checks pass. On the old reader 5 fail, and its render
    check reports both rules dead. The workflow now runs when the table
    changes.
  - **Red on `e49a370c`: 9 of 67 in the two files.** Those are the three new
    unit tests and six route cases. The two route formatting controls, both
    properties and every retained case pass there.
  - **The first cut judged junk, found by measuring the count changes.**
    With the 200-character bound lifted, 9 of 203 remained, each junk with no
    name in it (`~/**/+`). The kept boundary's `*` read as the universal
    selector. No false alarm could follow (the browser throws, and a throw is a
    hit), but it counted as judged. Fixed in `9aef0ca2`: now 194 of 194 count
    changes are the length bound, none downward.
  - The unit formatting control fails on the old code only on two lines:
    `.a>/**/.b` and `.a/**/[x]`. The old key read those comments as
    descendant spaces (`.a    [x]`, which is the wrong meaning) and named the
    rules. That is the safe direction.
  - The 67 focused files read 2,016 / 2,016. The suite locally reads
    `7973 / 7971 / 0 / 2` (+11: `css-scope` +3, `edit-failure-paths` +8).
  - **Unit CI** on `3cee046f` (run 36220333869) reads `7973 / 7969 / 0 / 4`,
    with all 20 cases of the two changed test files found passing by name,
    7,973 distinct result numbers and no failure.
  - **Unit CI** on `9aef0ca2` (run 36220840818) and on the documents commit
    `0de188ff` (run 36220937877) both read `7973 / 7969 / 0 / 4`, with the 20
    cases of the two changed test files passing by name on both.
  - **Site build on `9aef0ca2`** (run 36220840763, 21m00s, all twenty steps)
    has all twelve counts green: TAP 397, site-build **404** (382 plus the
    control's 22) and the rest as recorded, with only the two known
    annotations. **The browser control, read from that run's own step file:
    22 ok, 0 FAIL.** For each of the six spellings, the cascade applies the
    rule exactly where the table says; `plainSelectors` hands the judge the
    table's string; and `querySelectorAll` agrees with the cascade. The real
    render check, asked about `.a/**/.b` and `.a .b`, reports exactly
    `.a .b` dead.
  - The parent `3cee046f`'s site build (run 36220333864) passed the same way.
    It is on record, and not used in place of `9aef0ca2`'s.
  - There was no mutation sweep, per the instruction; the red run is the
    evidence the cases bite.
- **⚠ Found in my own evidence, fixed: the property tests' random generator
  was degenerate.** `(seed * 1103515245 + 12345) & 0x7fffffff` overflows 2^53,
  so every seed became a multiple of 512 and `rnd(2)` answered 0 in 19,920 of
  20,000 calls. Consequences:
  - Item 3's formatting property inserted formatting only 183 times across its
    1,500 sheets.
  - The gate battery respaced a sheet 3 times in 3,000 pairs and used 6 of its
    12 selectors.

  Now it uses exact 32-bit arithmetic read from the high bits:
  - 24,558 random insertions, plus 49,134 bare comments;
  - every way a lane answers a sheet reached 475–513 times;
  - both properties still hold.

  The floors now prove it: a floor on the insertions, and every way reached.

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

**The press that confirmed deploy 2161 at runtime — free, pressed by you as
run 33** (see *Merged and deployed at `0de188ff`*). It also confirms
everything deploy 2160 carried, since 2161 runs that code too. The form shows
each box's description:
- <https://github.com/canias7/isibi-app/actions/workflows/edit-canary.yml>, run
  from `main`.
- "Run the ONE paid edit as well": `no`.
- "Refuse to spend unless the Worker reports this deploy sha":
  `0de188ff2d3a00d8096b01f8616c507aea2bbce4`.
- "Refuse to spend unless a cold container reports this image id":
  `05750a5120d33570`.
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

### 6. Live acceptance — Test 3: pressed as run 34, all seven items hold; CLOSED by the owner (2026-09-26)

**The result.** Run 34 (run 36224239033, your paid press, from `main` at
`0de188ff`) counts as the test, and every acceptance item below holds:
1. **It counts as the test.** The request sha matches (63 characters). Its own
   before-read equals the six bodies, the preflight passed with both
   expectations, and a stored terminal reply arrived.
2. **Published at the job's own version.** A stored 200 arrived under
   `x-gf-edit: final` at 376.5 s. `x-site-version` moved to
   `01790404806543-kk6qsh`, minted 06:40:06Z inside the run. `compare.json`
   reads VERIFIED.
3. **The removal, in the stored source.** The chords block is gone; the unused
   `ChordDiagram` import and the `CHORDS` data went too (noted, not failed).
   Every other block and all other code is byte-identical, and the page lost
   exactly the removed code's 487 tokens and gained none. It is byte-identical
   to the removal built by hand as the evaluator's control.
4. **The other five files** are byte-identical. `chord-diagram` is still
   stored.
5. **The live page, in a real Chromium at `kk6qsh`:**
   - the headings are in the expected order, with 0 chord diagrams;
   - the rendered text is the before-reading's (taken at 06:39Z) with only the
     chords section cut out, 543 → 450 words;
   - the guitar draws and turns, and the day box is right for four days
     against the real `bookings_on_day`;
   - 0 console errors, 0 failed requests;
   - `/prices` and `/gear` render identically, and `/prices`' three `gbp_eur`
     502s were there before the edit too;
   - `/fr` and `/es` lost the section too.
6. **Money.** 91 → 73 = route 2 + edit 16. The ledger holds one reserve of 16
   (balance after 73) and no refund; the job is `finalized`, cost 16.
7. **The reply**, *"✅ Updated /. …"*, is true. The render check's #418 finding
   (on `/`, `/es` and `/fr` at phone width) is passed on, not verified.

**Which writer ran.** The router chose `look` for `/`, and the lane picker
chose `components`, which runs the page rung. The quick writer was attempted
(`tweakUsage` 8,359 in / 67 out), followed by the full writer. Why the quick
attempt did not publish was not captured, and its usage alone does not
establish that it declined. The full writer made the change
(25,077 in / 8,011 out), and the judge ran (`keepUsage` 931 in / 46 out). So
full-writer coverage is claimed, and both preservation checks, which run on
the full writer's answer before anything publishes, let this answer through.
Neither verdict is on the wire. This is also the first live run where the
router named a page on a `look` answer (`/`, which is also the default).

**What it does not show:** one sentence on one site, with the writer's prompt
and the verdicts not captured. #418 stays open. The site now serves the
section removed; the restore mode puts `01790360265159-n7mtnq` back for free.

The preparation, as it stood before the press:

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
  - "Refuse to spend unless the Worker reports this deploy sha": `0de188ff2d3a00d8096b01f8616c507aea2bbce4`.
  - "Refuse to spend unless a cold container reports this image id": `05750a5120d33570`.
- **These two values name deploy 2161**, read off its own log (see *Merged
  and deployed at `0de188ff`*, below). The top section's fixes are in it. The
  sentence's supplied-answer check was re-run on the deployed code (about
  05:58Z): the correct removal passes, with or without the unused import and
  with or without the page list, and a collateral loss or the wrong page is
  refused. Neither is on the
  expected path: one needs the css lane picked, the other a failure of ours
  whose restore also fails. Which rung the router picks is itself part of what
  Test 3 measures, so that is an expectation, not a promise.
- **The starting state:** live `01790360265159-n7mtnq`: the header read again
  on `/`, `/prices` and `/gear` at 05:38:24Z on 2026-09-26. The headings were
  last read at 01:01:55Z, in run 32's order, on the same version. The press's own
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
  quick attempt (from under 1 when it stops at once up to ~6 when it
  rewrites the page first, as in run 24), and the judge (~1). The balance is
  91, read by run 33's free press (unchanged since run 32's end).
- **The starting state, read by run 33 (06:24Z):** all three routes answer
  `01790360265159-n7mtnq`. The six stored bodies are byte-identical to run
  32's after-read, with the same path set, and each matches its recorded hash.
  The paid run's own before-read must equal this, or it is not Test 3.
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

The same press takes the before-read Test 3 starts from. *(Superseded: deploy
2161 below moved both values, and nobody pressed this one. Run 33 then
confirmed 2161, which runs all of 2160's code.)*

### Merged and deployed at `0de188ff` (2026-09-26)

The top section's batch passed the owner's review at `0de188ff`. Its site build
on `9aef0ca2` passed, browser control included (the top section's evidence).
Main was then fast-forwarded `7384ddba` → `0de188ff` (9 commits, 20 files) at
05:49:22Z, which deployed as deploy 2161 (run 36221930265, success, 05:49:27 →
05:52:15Z):
- Before the push: main was unmoved, nothing was in flight, and the rollback
  (`git revert --no-commit 7384ddba..0de188ff`) gives main's own tree back.
- The image was predicted from the merged tree as `05750a5120d33570` (187
  inputs), and the deploy **built exactly that** (the registry answered 404).
  It rolled over from `c3cc126e45e93815` under `SUCCESS Modified application`.
- The Worker reports `DEPLOY_ID` `0de188ff…`; Wrangler's new version is
  `c7c5567…`.
- `public/` did not change, so no asset was uploaded and there is no
  served-file check. The served `chat.js` stayed byte-identical to the merged
  file.
- The auth gates answer 401 / 401 / 401 / 404.

A green deploy is Wrangler reporting on itself. The session's one attempt at
the free press, made at 06:08:20Z after the rollout hold, answered **403
Resource not accessible by integration** and was not retried.

**Runtime-confirmed by your free press, run 33** (run 36223626560, from
`main`, 06:23:55 → 06:24:37Z, spending off, both expectations in their own
boxes):
- `build-health 200 deploy=0de188ff2d3a image=05750a5120d33570` and
  `runtime 200 deploy=0de188ff2d3a async=true runner=true` (the control,
  washhouse-3, async too).
- Every preflight check is `ok`, including "the Worker is the expected build"
  and "a cold container gets the expected image".
- The zero-cost checks pass. The free job settled in about 6 s as
  `{"ok":false,"escalate":true,"reason":"empty","cost":0}`.
- `ALL FREE CHECKS PASSED`. The balance was 91, and the run stopped before the
  paid edit with nothing charged.
- Its before-read is Test 3's starting state (section 6 above).

This is the live Worker answering. Deploy 2160's own moment was never read
live, but every commit it shipped is in `0de188ff`.

### Stopping point

Deploys 2160 and 2161 are merged and deployed, and **2161 is
runtime-confirmed** by your free press, run 33, which also confirms 2160's code.
**Test 3 ran as your paid press, run 34, and all seven acceptance items hold**
(section 6). Nothing further is dispatched.

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
