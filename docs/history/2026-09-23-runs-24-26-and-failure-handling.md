# Edit-path history, 2026-09-23: runs 24 to 26 and the failure handling

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). In order: run 24 (the
> places-left replay's verdict), the correction test and runs 25 and 26, the
> read-only edit-path review, every way the edit route declines classified
> (deploy 2146), a named page reaching the page it names (2147), one page
> operation for neighbouring page lanes and no second run of a page operation
> that succeeded (2148), a page verb belonging to its own step (2149), and the
> reply naming the page operations that shipped, with the scoped no-change
> sentence (2150).
>
> What is still law from these rounds is summarised in CLAUDE.md.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at its other sections.

### RUN 24 — THE REPLAY: THE STATES HOLD, AND THE ANSWER IS NEVER CHECKED (2026-09-23)

**`35807954856`, paid, dispatched from `main` (01:50:31 → 02:02:41Z)** — so
the OLD blind harness (`pages: []`), and the router answered `intent=edit
layer=page page=/` in 38.1 s (`6,631 in / 19 out`, cost **2**) — the same
luck runs 17 and 21 had. **So run 24 is no reading of the corrected harness**:
that stays on the branch, and a press that should use it is dispatched from
the branch until it merges (owner: *"Retain the corrected harness for future
runs"*). **It IS the replay**: the request's sha is the recorded one (159
chars), its own before-read is byte-identical to run 17's on all six bodies,
and it published. Job states `claimed` (cost 0) to ~345 s, `routing` (cost 22)
from ~358 s, `publishing` at ~643 s, a stored 200 under `x-gf-edit: final` at
**646.5 s** (190 polls, 0 transient) — intervals, not attributed. The live
header moved to **`01790128661913-dafwjz`**, minted **01:57:41.913Z**, inside
the window.

- **COST: route 2 + edit 22 = 24, balance 46 → 22, closing exactly.** `tweak`
  absent, `tweakUsage` **8,314 in / 7,602 out** — this time the quick writer
  re-emitted the whole page and still did not publish (run 21's attempt was 53
  tokens), so the edit landed in the quoted "dearer" band; why it did not
  publish is still on neither the reply nor the trace. The full writer: **24,652 in / 9,410 out**.
  `langs` fr/es `cached, missing 0`.
- **TWO FILES CHANGED, FOUR BYTE-IDENTICAL.** `index.tsx` 26,276 → 26,248
  chars (`e8a2a0a6fc68f6ea`), two lines: the `useRpc` result is kept WHOLE
  (`const bookingsOnDay = useRpc(…)`) and passed as `query={bookingsOnDay}`
  instead of `bookingCount={Number(bookingCount ?? 0)}`. `day-space-lookup`
  1,466 → 1,932 (`4b162037f67df545`): takes `query: {isPending, isError,
  data}`, shows `Checking…` / `Couldn't check — try again` / `Not available` /
  `Six places left.` / `N places left.` / `1 place left.` / `None left.`
  `chord-diagram`, `trial-booking-form`, `gear.tsx`, `prices.tsx` unchanged.
- **THE BOX USES THE RULE'S OWN EXAMPLE WORDS VERBATIM** — *"Checking…"*,
  *"Couldn't check — try again"*, *"Not available"* are rule 11's three
  examples. That is **strong evidence the rule reached the writer**, which the
  vanished warnings alone could not be; the prompt is still not captured.
  `problems` is **0**: run 21's four *"does not declare"* warnings are gone,
  which is the new lookup's FIRST LIVE READING on an `incomplete` site inside
  the container — the rung's lint read the real spec.
- **PROBE v3 ON THE LIVE BOX** (02:06Z, `dafwjz`, no row written): successful
  counts **MATCH 7 of 7** — 0 → *"Six places left."*, 1 → *"5 places left."*,
  2 → *"4"*, 5 → *"1 place left."*, 6/7/99 → *"None left."*; held **READ 6 ·
  MATCH 2** (every pending reading *"Checking…"*, the day switch included);
  upstream failures **READ 7** (*"Couldn't check — try again"*, after the
  retries); empty responses **READ 4 · FAIL 1** — 200 `null`, empty body and
  `{}` → *"Not available"*, 204 → *"Couldn't check — try again"*, and **200
  `[]` → *"Six places left."***; the real function **200 body `0`** → *"Six
  places left."*, correct. No console errors, no failed requests beyond the
  probe's own. **Its five "empty" shapes are a sample, never a type census.**
- **⚠ THE DEFECT IS UNRESTRICTED `Number(data)`, NOT AN EMPTY LIST (owner:
  *"don't close the remaining issue as an empty-array exception"*).** The first
  write-up of this section called `[]` the one failing state — which was the
  PROBE'S list speaking, not the component. `placesLeftLabel` refuses
  `data == null` and a non-finite `Number(data)`, then does arithmetic on
  whatever `Number` made. **Reproduced free** against the saved component
  (`4b162037f67df545`, rendered with real React through `renderPart`):
  `[]`, `false`, `""` and whitespace → *"Six places left."*, `true` → *"5
  places left."*, `[2]` → *"4 places left."* — the owner's six, exactly — and
  beyond them `[0]`, `"0"`, `"\n"`, `-1` and `-0.5` → Six, `"3"` → *"3 places
  left."*, `[7]` and `"7"` → *"None left."*, `1.5` → *"4.5 places left."*.
  Only `{}` and `"abc"` (a NaN) are refused. **The render agrees with the live
  probe on every value both read** (`[]`, `{}`, `null`, the empty body, the
  seven counts); a 204 never reaches it as an answer, since TanStack turns
  `undefined` data into an error — the probe read *"Couldn't check"*.
- **TWO CLAIMS, KEPT APART (owner).** The saved generated component is
  DEFECTIVE for malformed answers — established. The real function sending
  one — **NOT shown.** Read twice at 02:27Z (a real day, and the empty day the
  page sends on load): **200, `application/json; charset=utf-8`,
  `content-range: 0-0/*`, a body of the one byte `0`** — PostgREST's scalar
  answer. `proxySiteService` returns the upstream status, content-type and
  body verbatim, and the kit's `send()` validates nothing: 204 → `undefined`,
  a body that is not JSON → `null`, a non-2xx → throws, anything else →
  `data`, as parsed. **The declared return type lives in the site's stored
  schema and in the digest line the writer is shown (`name(args) ->
  <returns>`), and no route serves either to a session**, so the contract is
  OBSERVED as a JSON integer, never read.
- **`Not available` classifies READ with the note *"may read as full"***: it
  advertises no places, so it passes item 1; whether it reads well is the
  owner's call, as recorded before the press.
- **THE CUSTOMER'S SCREEN**: *"✅ Updated /. I had a look at the finished
  pages: / threw an error and 2 pages reads something the check can't reach,
  so I couldn't see it with real data."* *"Updated /"* is true, and the rest
  relays the render check faithfully: `/` [phone] React #418, `/` and
  `/prices` `unmet` (by design). **⚠ BUT #418 IS UNRESOLVED (runs 11, 21 and
  24), so whether *"/ threw an error"* is true of a visitor's page is not
  established, and the reply is NOT verified as a whole (owner).**
  `deadSelectors` the same two as before.
- **THE VERDICT, KEPT NARROW**: items 2, 3 and 4 pass. Item 1 passes for every
  loading, failed and missing state and **fails on response-type validation** —
  a successful answer that is not a count is turned into one. Item 5 is open
  while #418 is. **The acceptance stays OPEN.** What is established is that a
  real model, given rule 11 through the page rung on an `incomplete` site,
  produced the query hand-off and the three states — for this sentence on this
  site, and nothing wider.
- **THE CORRECTION IS BUILT, MERGED AND DEPLOYED (deploy 2145, below) — NOT
  PROVEN BY A MODEL** (owner, 2026-09-23: *"Implement the bounded rule-11
  guidance correction now"*). Rule 11 already forbade `Number(data)` — as a
  DEFAULT, and the writer read it that way, converting after its null check.
  The sentence *"Only a real answer may state a number, "none left" or "has
  space""* now goes on: **a real answer is one that matches what the function
  is declared to return** (the digest prints it after the arrow), **checked
  before any calculation**; *"For example, a booking count is real only when
  `typeof data === "number" && Number.isInteger(data) && data >= 0`. That check
  is for a count, not for every function"* — one declared to return a price, a
  difference, a row or a list may rightly answer a decimal, a negative number,
  an object or an array, and is checked against its own declared type; **a zero
  that passes is a real answer** (test the type, never truthiness); anything
  that fails gets the "nothing" words; and **never convert** (`Number(data)` and
  `+data` turn `[]`, `""` and `false` into 0 and `true` into 1; `parseInt`
  reads `[2]` as 2). No parser, no kit component, no reporting change.
  - **Rules measured**: full **42,409 → 43,307** (+898), shopfront **27,909 →
    28,807**, frontend **29,077 / 14,073** unchanged.
  - **Guards** — `test/edit-page-rpc-state.test.mjs`, 8 → **12** cases: the
    wording, with the integer check asserted to occur ONCE in the whole prompt
    and only inside its *"For example … not for every function"* frame; the
    rule's own claims about JavaScript asserted true; reach through
    `pageRulesFor` (both kinds, a function-only spec), `pagesRequest` /
    `bandRequest` / `partRequest` (one block) and the real edit route's writer
    on an `incomplete` site, a recovered one and a site that gains a database;
    **the frontend prompts DERIVED byte-identical** — the addition cut back out,
    the frontend prompt derived from what is left and compared, because an
    absence alone cannot say *unchanged*; and run 24's stored component
    (`test/fixtures/run24/`, 1,932 chars, sha `4b162037f67df545`) reproducing the
    owner's six, beside **a SUPPLIED implementation** built from the rule's own
    example expression — hand-assembled, never a model's answer, so it proves the
    example check is sufficient for that component and nothing about whether a
    model writes it. **Red 8 of 12** against the unchanged rule text in a
    throwaway worktree (the four that pass: the older paragraph's case, two
    refusals that call no writer, and the fixture reading).
  - **Focused mutation check** `scripts/mutants/rule11-check.json`: **8
    mutants, 8 killed, 0 survived, 0 never applied, the comment-only control
    surviving**, against the one guard file — the requirement gone, the
    example's frame gone, the example made universal, `>= 0` dropped,
    `Number.isInteger` dropped, the zero clause gone, the conversion clause
    gone, and rule 11 let into the frontend prompt; `page-gen.mjs`
    byte-identical to its backup afterwards.
  - **Suite 7,179, BOTH HALVES TAKEN** — locally `# tests 7179 / # pass 7179 /
    # fail 0 / # skipped 0`, `duration_ms 128,347`, and CI unit run
    **`35829428954` on `821a60ac`** at **`# tests 7179 / # pass 7175 / # fail 0
    / # skipped 4`**, `duration_ms 118,250` — the TOTAL is what matches, `pass`
    differing by exactly CI's own four skips — with **all twelve of the guard
    file's cases matched BY NAME among the passing lines** of the downloaded
    log. **+4 against 7,175**, exactly the four new cases. The focused set
    (the fifteen files of the `rpc-state` sweep) re-run on the committed tree
    reads **615 / 615 / 0 / 0**. **AND `site build` run `35829428934`**
    (07:00:05 → 07:22:28Z, **22m23s**, all twenty steps) read all twelve counts
    green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4,
    site-build 382, contrast-cases 16, theme-seam 11, theme-render 29,
    site-routing 14, site-runtime 47, kit-render / kit-a11y / kit-effects /
    kit-paint `all passed`, census 7 + 4 + 1 = **12**; the two known
    `##[error]` annotations each directly above their own `ok` lines,
    `tsc`-format lines 9 / 2 / 7, `site-build.mjs` 16m02s. **The rendered rules
    were re-measured on the parent (`3281c084`) and the commit in two real
    checkouts**: the full rules `e6f6b98731de6ec6` → `d36aeba09acc8a94`
    (42,409 → 43,307), shopfront 27,909 → 28,807, and **both frontend prompts
    byte-identical on both sides** (`e926db932bfd4666` 29,077 and
    `935cc9b048e4a270` 14,073) — a second instrument beside the derived
    comparison in the guard. **The stamp chain ends here.**
  - **WHAT IT DOES NOT DO.** The live `fretwork-1` still serves run 24's
    generated code (`01790128661913-dafwjz`) and nothing here repairs it: the
    rule reaches only a FUTURE page write (merged and deployed since;
    `page-gen.mjs` is an image input, so the image rolled). **#418 stays
    separate and unresolved.** And the acceptance stays OPEN until a paid run —
    the owner's call.

### MERGED, DEPLOYED, AND THE CORRECTION TEST PREPARED (2026-09-23)

Owner: *"Merge and deploy the reviewed change, preserving newer main commits
and the corrected route-list harness. Verify the actual deployed SHA and
container image. Then prepare the smallest live verification against Run 24's
current state."*

**A FAST-FORWARD, BECAUSE THERE WAS NOTHING NEWER ON MAIN TO PRESERVE.**
`origin/main` was unmoved at `33126616` (`HEAD..origin/main` empty), so `main`
`33126616` → **`0d5137f0`** at **07:33:58Z** — 7 commits, 11 files — keeps every
main commit by construction. **The route-list harness (`cd944888`) is on main
now**, so a dispatch from `main` routes with the site's real page list, as the
browser does. **Asked before the push, not assumed**: zero runs in progress or
queued; the image id predicted over both ends; and the rollback verified —
`git revert --no-commit 33126616..0d5137f0` in a throwaway worktree gives tree
**`bbdc2444…`, main's own**, so a rollback reuses `962824ede93e7706`.
`builder/page-gen.mjs` is the push's one product file and its one image input.

**DEPLOY 2145 (`35832383057`) — DEPLOYED, AND RUNTIME-CONFIRMED BY RUN 25
(below).** Job
**2m47s**, image step **2m01s** with **0 `CACHED` lines** (every layer rebuilt,
and faster than 2144's cold 2m56s — the timing says nothing about the diff),
Wrangler 18s.
- **THE SIXTEENTH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `962824ede93e7706` (the id run 22 read LIVE) and the
  tip `ce67f25d132667d0`, both from 184 inputs. The log answered `built
  isibi-app-sitebuildcontainer:ce67f25d***32667d0 (registry answered 404;
  ***84 inputs off ./Dockerfile)` and `- …:962824ede93e7706` →
  `+ …:ce67f25d***32667d0` under `SUCCESS Modified application`, `Applied
  changes`.
- **THE WORKER HALF**: `DEPLOY_ID: 0d5***37f0a7eba5***806d***b3063e87d57ef2092aa4`
  (the merge sha, masked), `Uploaded isibi-app`, `Current Version ID:
  05dc038b-…`, `Deployed isibi-app triggers`; **`No updated asset files to
  upload`**, so there is no served-file check. Gates **401 / 401 / 401 / 404**
  at 07:38:43Z.
- **WHY IT STOPS AT "DEPLOYED"**: both routes that return the sha and the image
  — `/api/site/build-health` and `/api/site/runtime` — ask `authUser` first
  (re-read in `worker.js` today), so the live Worker's own answer needs a
  signed-in press. **Press 1 below is that reading, and it has teeth**: the
  form's `expect_deploy` and `expect_image` refuse on any mismatch.

**THE PREPARED TEST IS A CORRECTION, AND A CORRECTION IS NOT THE GENERATION
PROOF** (owner: *"Don't treat those as the same proof"*).

- **(A) CORRECTING THIS COMPONENT — prepared.** From run 24's live state, one
  paid edit whose instruction NAMES the defect. It can establish that the
  deployed page rung — rule 11 in the prompt, the existing component shown to
  the writer — repairs the answer check on request without breaking what run
  24 got right. **It cannot establish that rule 11 did the work**, because the
  instruction alone asks for the fix. The instruction names the defect and the
  outcome ("only a real count") and deliberately leaves out the check, zero,
  the integer and sign conditions and the wording, so those have to come from
  somewhere — the rule's own example expression or zero clause appearing in
  the answer would be EVIDENCE the rule reached the writer, never proof.
- **(B) GENERATING A CORRECT COMPONENT FROM THE ORIGINAL REQUEST — not
  prepared.** That is run 24 again under the corrected rule: restore
  `01789972018761-6tng48` (free, the canary's restore mode), then replay run
  17's sentence byte for byte (sha `622547386217ef0c…`). Only (B) says whether
  a writer given *"count down the places left"* writes the answer check
  unprompted, which is what rule 11 exists for. It needs a restoration, which
  this step excludes. **~24 credits** (run 24's measured cost, band 17–30) plus
  the free restore.
- **A pass of (A) says nothing about (B).** A failure of (A) says the
  correction path fails even with the defect named, which is the stronger
  finding of the two.

**THE STARTING STATE, READ FREE TODAY.** Live `x-site-version`
**`01790128661913-dafwjz`** at 07:35:49Z — run 24's, nothing published since.
**Probe v4** is v3 with every group unchanged plus **MALFORMED ANSWERS**
(`false`, `""`, whitespace, `true`, `[2]`, `[0]`, `"0"`, `"3"`, `-1`, `1.5`,
`[7]`, `"7"`, `"abc"`, a non-JSON body), a count-claim note, and a
distinct-states line. Read twice against the live box, verdict lines identical:
counts **MATCH 7 of 7**; pending **"Checking…"**, failures **"Couldn't check —
try again"**, missing (null, empty body) **"Not available"** — **DISTINCT**;
malformed **FAIL 10**, plus `[]` in the empty group, so **11 wrong-kind answers
shown as availability**; `[7]` and `"7"` → **"None left."**, a count from a
non-count, not availability and flagged; `{}`, `"abc"` and a non-JSON body →
"Not available"; the real function **200 body `0`** → "Six places left.".
**The instrument is proven alive on the defect it must see go away**: it fails
today's box exactly where the offline render of the saved component said it
would.
**⚠ AND v4's FIRST CUT FILED `[]` AND `{}` AS "MISSING"**, so its
distinct-states line read NOT DISTINCT about a box whose three states are
distinct — the malformed `[]` was contaminating the missing category. Missing
is a null and an empty body; `[]` and `{}` are answers of the WRONG KIND.
Fixed in the instrument, not the product, and re-read. *A summary line is an
instrument too, and it can be wrong while every line under it is right.*

**THE PRESSES**, both `edit-canary.yml` from **`main`**, `expect_deploy`
**`0d5137f0a7eba51806d1b3063e87d57ef2092aa4`**, `expect_image`
**`ce67f25d132667d0`**, `site` fretwork-1, `control` washhouse-3,
`restore_version` and `read_job` blank:

1. **FREE — the runtime confirmation and the before-state.** `spend` no. The
   preflight reads the live Worker's sha and a cold container's image and
   refuses on a mismatch; prints `async`/`runner` and the balance; and
   `before/source.json` must be **byte-identical to run 24's after-read on all
   six bodies**: `index.tsx` 26,248 `e8a2a0a6fc68f6ea`, `day-space-lookup`
   1,932 `4b162037f67df545`, `chord-diagram` 3,861 `d0c20d52f91d69d2`,
   `trial-booking-form` 4,045 `4b66386c0ad46092`, `gear.tsx` 6,249
   `d580389f971cdd31`, `prices.tsx` 2,144 `0d2d72dee56a2a71` (the comparator
   re-proved both ways on run 24's artifact today).
2. **PAID — the correction.** `spend` yes, no earlier than ~07:55Z (15–20
   minutes after the deploy finished at 07:37:27Z), and the instruction
   **verbatim** — 197 characters, all ASCII, sha256
   `ab0e2144c0da4bfc0f7e597df908b13e544b9c05345985c81468d22c324ca4c2`:

   > The "Space on a preferred day" box shows places left even when the booking
   > lookup answers with something that isn't a number of bookings. Only a real
   > count of bookings should ever show places left.

**THE ACCEPTANCE — the original four, unchanged:**

1. **Malformed responses never become availability** — the fourteen malformed
   values plus `[]` and `{}`. `[7]`/`"7"` → "None left." is not availability
   and is REPORTED as a count from a non-count, since rule 11 lets only a real
   answer say "none left".
2. **A successful zero stays valid**: `0` → six places, and the unintercepted
   real function (which answers `0`) reads six.
3. **Loading, error and missing stay distinct**: one reading each, three
   different strings, none advertising.
4. **Unrelated files unchanged**: `chord-diagram`, `trial-booking-form`,
   `gear.tsx`, `prices.tsx` byte-identical; the fix belongs in
   `day-space-lookup`; `index.tsx` inspected, expected unchanged since the page
   already hands the component the query.

Beside them, as before: counts 1, 2, 5, 6, 7, 99 read 5, 4, 1 place (singular)
and none for the rest; the run COUNTS only if its request sha matches, its own
before-read matches run 24's after-read and it published. **#418 is reported,
never a pass condition.**

**WHAT EACH OUTCOME WOULD MEAN.** Rewrite published and all four hold: (A)
passes, for this component, this wording and this site. Some malformed value
still shown as places: the correction failed with the defect named and the
component shown. `0` → "Not available": a truthiness check, the zero clause not
followed. `-1` or `1.5` still shown as places: a type check without the
example's integer and sign conditions. States collapsed: a regression.
`tweak: true`: the one-file writer published without opening the component —
the door let it through and nothing did the work. A `rules` answer: not this
test, and it may change the site's database rules, recorded as what it is. A 503
`backend`: the incomplete-site lookup, not the writer. `addon`: the canary's
intent gate refuses to spend.

**COST, ESTIMATED FROM MEASURED RUNS — NOT A CAP.** Run 21 was route 2 + edit
15 (the quick attempt used 53 output tokens and did not publish), run 24 route
2 + edit 22 (it re-emitted the page first). This press differs by ~300 tokens of rules and a
component 466 characters longer, so **~17–24 credits, perhaps ~30** with a
correction round. Nothing enforces a per-request limit; the balance is the only
bound. **Balance 22 at run 24's end**: if press 1 prints under ~30, top up
first — a reservation refused partway stops the edit, and that tests nothing.

### RUN 25 — THE FREE PRESS: 2145 CONFIRMED, THE STARTING STATE EXACT (2026-09-23)

**`35842017069`, free, `main` at `0d5137f0`, 09:17:03 → 09:17:39Z, canary step
18 s.** `build-health 200 deploy=0d5137f0a7eb image=ce67f25d132667d0`,
`runtime 200 deploy=0d5137f0a7eb async=true runner=true`, both readers agreeing
and both form expectations matched — **the live Worker answering, not Wrangler
reporting on itself, so deploy 2145 is deployed AND runtime-confirmed.** The
two zero-cost async checks settled `{"ok":false,"escalate":true,
"reason":"empty","cost":0}`, as every free press does.

- **THE STARTING SOURCE IS EXACTLY RUN 24's AFTER-READ**: the artifact's
  `before/source.json` (`complete=true`, all three `reads` true) is
  **IDENTICAL on all six bodies, same path set** — `index.tsx`
  `e8a2a0a6fc68f6ea`, `day-space-lookup` `4b162037f67df545`, `chord-diagram`
  `d0c20d52f91d69d2`, `trial-booking-form` `4b66386c0ad46092`, `gear.tsx`
  `d580389f971cdd31`, `prices.tsx` `0d2d72dee56a2a71`. **The control**: the
  same comparator against run 24's BEFORE-read answers DIFFERS at exactly
  `index.tsx` and `day-space-lookup`, the two files run 24 changed.
- **The header agrees**: `x-site-version: 01790128661913-dafwjz` at 09:19:10Z.
  So probe v4's before-reading (this section above) still describes the live
  box — same version, same bodies.
- **Balance 22** — under the ~30 this section set as the top-up line, since
  route 2 leaves 20 and run 24's edit alone was 22. **The paid press is
  prepared and not made**; nothing has spent since run 24.

### RUN 26 — THE CORRECTION: ALL FOUR HOLD, AND IT LANDED ON THE PAGE (2026-09-23)

**`35842461500`, paid, `main` at `0d5137f0`, 09:21:35 → 09:29:41Z.** It counts
as the test: the request is 197 chars with sha256 `ab0e2144…` (`source:
CANARY_INSTRUCTION`), its own `before/source.json` is identical to run 24's
after-read on all six bodies, and it published — `x-site-version`
**`01790155568567-c1td33`**, minted **09:26:08.567Z**, inside the window.
Preflight `0d5137f0a7eb` / `ce67f25d132667d0`, `async`/`runner` true.

- **THE ROUTER WAS GIVEN THE SITE'S REAL PAGES** (`/, /prices, /gear`) — the
  route-list harness's first live run from `main` — and answered `intent=edit
  layer=page page=/` in 30.1 s, cost 2 (`6,645 in / 19 out`).
- **COST: route 2 + edit 17 = 19, balance 22 → 3, closing exactly.** No top-up
  was made and it fitted. `tweak` absent, `tweakUsage` `8,309 in / 53 out` (a
  quick attempt that did not publish, as in run 21; the reason is still not on
  the wire); the full
  writer `25,027 in / 8,820 out`; two translation calls `980 in / 35 out` (fr
  and es `missing: 1` each — see the finding below). Job states `claimed`
  (cost 0) to ~194 s, `routing` (cost 16 → 17) from ~207 s, `publishing` at
  ~407 s, a stored 200 under `x-gf-edit: final` at 414.1 s (123 polls, 0
  transient). `problems` 0 — the lookup read the real spec again.
- **ONLY `index.tsx` CHANGED** (26,248 → 26,563 chars, `8041046d0e4aba77`), in
  two hunks: `const bookingCount = typeof bookingsOnDay.data === "number" &&
  Number.isInteger(bookingsOnDay.data) && bookingsOnDay.data >= 0 ?
  bookingsOnDay.data : null`, and the component handed `{ isPending, isError,
  data: bookingCount }` instead of the raw query. **`day-space-lookup` is
  byte-identical** (`4b162037f67df545`), so the prediction that the fix belongs
  in the component was wrong; the acceptance said `index.tsx` is inspected, and
  inspected it is those two hunks and nothing else. `chord-diagram`,
  `trial-booking-form`, `gear.tsx`, `prices.tsx` byte-identical.
- **THE CHECK IS RULE 11's EXAMPLE EXPRESSION VERBATIM**, and the instruction
  named none of its integer or sign conditions — evidence the rule reached the
  writer, never proof (the prompt is not captured).
- **⚠ THE CHECK LIVES ON THE PAGE, NOT IN THE COMPONENT.** `placesLeftLabel`
  still does `Number(data)`; it is safe here only because the page hands it an
  integer ≥ 0 or `null`. The component reused elsewhere with a raw answer would
  convert again.
- **PROBE v4 ON THE LIVE BOX (09:30Z, `c1td33`, nothing written): FAIL 0.**
  Counts **MATCH 7 of 7** (0 → *"Six places left."*, 1 → 5, 2 → 4, 5 → *"1
  place left."*, 6/7/99 → *"None left."*); held **READ 6 · MATCH 2** (every
  pending reading *"Checking…"*, the day switch included); failures **READ 7**
  (*"Couldn't check — try again"*); empty **READ 5** (200 `null`, empty body,
  `[]`, `{}` → *"Not available"*; 204 → *"Couldn't check — try again"*);
  malformed **READ 14, FAIL 0** — every one *"Not available"*, `[7]` and `"7"`
  included, so no count is made from a non-count any more; the real function
  **200 body `0`** → *"Six places left."*. Plain loads at 1280×900 and 390×844:
  NAV 200, 0 console errors, 0 failed requests.
- **THE FOUR ITEMS**: malformed never availability ✓, zero stays six ✓,
  loading / error / missing distinct ✓, unrelated files unchanged ✓. **(A)
  passes — for this component, this wording, this site. (B), generation from
  the original request, is untested.**
- **THE CUSTOMER'S SCREEN**: *"✅ Updated /. I had a look at the finished
  pages: 2 pages threw an error and 4 pages reads something the check can't
  reach, so I couldn't see it with real data."* *"Updated /"* is true; the two
  errors are #418 on `/` and `/es` at phone width, **still unresolved**, so that
  clause is not verified; the four `unmet` are by design.
- **⚠ NEW FINDING: THE TRANSLATOR READ CODE AS PAGE TEXT.** `extractText` took
  `= 0 ? bookingsOnDay.data : null; return (` as JSX text — the `>` of `>=` read
  as a tag's end, running to `<SiteChrome` — so that chunk was the one
  "missing" string, sent to the model for fr and es and applied back into the
  translated pages' code. **The compiled check is identical in all three
  language chunks** (`index-CKn4l9II`, `index-BjcqMVEi`, `index-CkAVYpOq`), so
  this time the answer left the code intact — but any other answer would
  rewrite code on `/fr` and `/es`, and any `>` comparison in page-level code
  triggers it. In the backlog; not fixed.

### THE EDIT-PATH REVIEW (2026-09-23, read-only, at `0d5137f0`)

Owner: *"Close the booking-box correction as demonstrated by Run 26. Keep
first-attempt generation unverified, and park translation and the hydration
finding for now."* The goal it serves: a customer changes an existing site, the
change works, unrelated content survives, and the reply describes the result.

- **CLOSED — the booking-box correction (A)**, as demonstrated by run 26: all
  four items held live. **(B), a correct component from the original sentence
  on the first attempt, stays UNVERIFIED.** **PARKED (owner)**: the translator
  reading page code as text (backlog) and React #418 (runs 11, 21, 24, 26).

**HOW THE PATH REALLY ROUTES, read out of the code rather than the docs.** The
router answers ONE layer (text · data · rules · look · picture · logo · nav ·
page · rename, or `addon`), and `readEdit` kept a page ONLY for the page layer
(`site-ask.mjs:872`; **`look` keeps one too since the wrong-page fix, below**).
Only `look` runs several steps (`pick_lanes`, ≤4 lanes,
five of which — purpose, components, shape, three, tsx — dispatch to the page
rung). **Every `escalate` with no `layer` is answered `up` by `escalateAction`
and starts `go()` = `reactSend(…, 'revise')`: the full rewrite of every page,
with nothing shown and no price** (`edit-poll.js:469-485`, `chat.js:9151-9189`,
`8746-8751`). A refusal body with no `msg` does the same (`chat.js:9076`).
**⚠ Both closed on the branch the same day — the next section.**

**REPRODUCED FREE THROUGH THE REAL ROUTE** — every model answer SUPPLIED, the
browser's own composer executed through `editBrowserReply`. Scratch scripts
only; nothing added to the repo.

1. **data on an `incomplete` site** → `{escalate, no-backend}`, zero model
   calls → full rewrite. The rung still asks `siteBackendBySlug`
   (`worker.js:21297-21298`); the rules rung on the identical fixture resolved
   the database and reached its model call.
2. **a photograph that lives only in a component** → the picture rung is
   handed `pages: eSrc` (`21957`), finds no slot → `no-slots` → full rewrite.
3. **"take the blog page off" on a site with none** → `{escalate, no-page,
   verb: remove}` (`21215`) → full rewrite, whose own contract says a page not
   returned is deleted.
4. **two page steps both refused by the photograph protection** (409
   `withheld`, cost 0 each) → merged `{ok:false, layer:"look", partial}` at
   200 with no `msg` (`24071`) → full rewrite, and neither protection sentence
   is shown.
5. **look → `[shape, components]`** → the page rung runs TWICE on one
   instruction (`pick_lanes, write_tweak, write_tweak, write_pages`); the move
   landed and the screen says *"One part of that message didn't go through"*.
   `21157-21160` pushes one step per page lane with no dedup. **Fixed for
   NEIGHBOURING page lanes** — *one page operation for neighbouring page
   lanes*, below — **and across another rung**, order kept (*a page operation
   that succeeded is not run again*). **Both merged and live since deploy
   2148.**
6. **a section change routed through look on a two-page site lands on `/`**
   whatever page the message named (`fallbackPage`, `21153`): stored
   `index.tsx` changed, `gallery.tsx` untouched, *"✅ Updated /."* **Fixed on
   the branch for a page the router NAMES** — *a named page reaches the page it
   names*, below.
7. **the page rung's full writer drops an unrelated section** → published,
   *"✅ Updated /."* Nothing compares the sections or words that survived
   (the addon's `keptProse` is not used here), and `chat.js:10274` never reads
   what changed.
8. **the css lane drops an earlier rule** while answering the whole sheet →
   stored, *"✅ Updated the look — the design."* Its `keep` part is prompt-only
   (`site-lanes.mjs:465-485`).
9. **look + rename both succeed** → the screen says only *"✅ Updated the look
   — the design."*; the new address is on `body.msg` and never shown (the
   merged `layer` is `look`, `24075`, and that branch reads no `msg`).

**MONEY, DRIVEN THROUGH THE REAL QUEUE CONSUMER WITH THE RPCS FAKED:**
- **a refused rung inside a multi-rung message stays charged** — css ok +
  refused rename → reserves 1 + 1, `edit_finalize p_ok:true`, reply `cost: 2`,
  although the loop's own comment says a failed step charges nothing.
- **direct writes land before the one publish** (alias rows driven; data rows
  and rules DDL by reading); if that publish fails the whole job is refunded
  and the reply says *"your site is untouched"* while the address has moved.
- the routing call (≥1, **2 measured**) is never refunded (`19513-19516`), and
  `edit_refund` is all-or-nothing per job.

**THE SHARED BUILD EFFECT THAT MAKES THE FALL-THROUGH DANGEROUS.** The rewrite
every `up` lands on has **no photograph wall** — `keepPhotos`/`keptImages`
occur only on the edit page rung and the addon (`23010`, `23512`, `24053`
report-only, `26718`) — and on a site that already shows photographs it hands
the writer `imageDirective(0)`: *"PHOTOGRAPHS: none on this site … Every
picture is <SafeImage> with no src … that is the intended look here"*
(`budgetFor` answers 0 on a photographed revise; driven at helper level). That
is the sentence the edit page rung stopped sending after it stripped two
photographs. On the four `incomplete` sites the same rewrite is told there is
no database (recorded above, read not driven).

**ROUTER SIDE, read and driven at `readRouting` only:** an adopted site (one
opened on a browser that did not build it) has no page list until
`/api/site/routes` answers, so a message sent before then — or for the whole
page load if that read fails — routes as a FIRST BUILD (`chat.js:10885`), posts
the project's chat, `siteForChat` finds no row, and a fresh paid site is built
(`worker.js:14415-14427`). **Re-read hop by hop 2026-09-24, and every hop
holds**: `fromRow` (`public/site-list.js`) carries no `pages`; `isBuild =
!sitePages(site).length`; a build body carries `chat` and no slug; `siteForChat`
answers `null` for it, so `chatOwnsNoSite` is true and `freeSlugFor` names a NEW
site. The routes read is asked once per page load (`siteRoutesAsked`) and never
retried, so one failed read exposes every message of that load. **DRIVEN END TO
END the same day** (*an existing site whose page list has not loaded is built as
a new site*), which corrected one hop: the chat is **not** `srv_<slug>` — opening
the card runs `siteAdopt`, which makes a fresh local record, so the body carried
`chat: "site_<ms>_<rand>"`; `siteForChat` found no row for it just the same.
**FIXED THE SAME DAY, merged and deployed in deploy 2153** (*an existing site
waits for its page list*, below). Attachments reach only the
logo layer (`chat.js:8973`), and wording + colour cannot both happen in one
turn: the look door has no text lane, so the second half is an `alsoAsked`
sentence at best.

**EVIDENCE BY OPERATION — CORRECTED 2026-09-26 from a read-only census of
`edit_jobs`, WHICH HOLDS QUEUED JOBS ONLY** (a synchronous edit — every edit
before `EDIT_ASYNC_EVERYONE` on 2026-09-04, and any later synchronous fallback —
makes no row, so an absence here is the queue's, never proof that no edit ran):
every edit the queue has published, **51 jobs since 2026-09-01**,
all on fretwork-1 but run 9's. **This paragraph said "text — no live run", and
the census falsified it**: text — 1 (gap-sweep run 10, 2026-09-02) · look — 32
published 2026-09-01 → 09-07 across css, brand, favicon, lang, langs, theme,
description, wordmark, qr and behavior (and run 14's css refused twice and
refunded) · menu — 2 · site address — 1 published, 1 refused and refunded ·
page layout — lane-sweep jobs (three, shape, components, purpose, tsx) and
canary runs 9, 11, 32, 34 · custom components — runs 17, 21, 24, 26 ·
**a page removal — never published among the queued jobs inspected**, route
tests only · **rules — its first queued success is run 44 (2026-09-27), the
only stored reply in the queue naming that layer; it closed a table and
publishes nothing** · **data — its first queued row change is run 42
(2026-09-27), which publishes no version** · **logo, picture (a reframe) and a
page move — first published by run 39 (2026-09-27)** · photographs — kept by the quick writer's block move
(run 9, a real browser) and by the full writer (run 37) · combined — one look job
placed a QR code through the page rung (09-02); otherwise route tests and the
driven money cases above. **The only `exempt` jobs in the queue's history are
run 39's logo and move**, so the free-rung path first published through the
queue then. The jobs before 09-08 ran on older
code: live coverage of the path, not evidence about today's code.

**THE NEXT TASK — BUILT THE SAME DAY, next section; `no-lane` ended up
`explain`, not the control named here: no automatic full rewrite for a failure
the route can name.** Every no-layer `escalate` in the edit route is
classified — the revise genuinely does it (`up`), another rung does (a named
`layer`), or nothing above can (a sentence, cost 0) — and a census guard makes
a new `escalate` declare its class. Acceptance, each through the real route
with `editBrowserReply` recording NO paid follow-up and a customer sentence:
cases 1–4 above; an all-failed merge showing the steps' own sentences; and a
control proving a genuine `up` (text `too-much-text`, a look `no-lane`) still
reaches the revise. Whether a kept `up` is announced before it spends is the
owner's call.

### EVERY WAY THE EDIT ROUTE DECLINES IS CLASSIFIED, AND A REFUSAL NEVER BUYS THE REWRITE (2026-09-23)

Owner, after reproducing the review's missing-page removal and all-refused
cases independently through the route and the browser handler: *"Both produce
no customer sentence and would start the full paid rewrite. Fix this failure
handling first."* **Merged and deployed in deploy 2146 (below); no paid run.**
Bounded to edit failure handling; translation, #418 and architecture parked.

**THE CLASSIFICATION IS ONE TABLE**: `builder/edit-failure.mjs`
`EDIT_FAILURES`, **40 entries, keyed `<rung>/<name>`** because one reason means
different things on different rungs (`no-meta` is a hop on data, an add-on on
rules, a failed read on look). **Four classes, and the class is what the
customer's browser does**:

| class | n | the browser | entries |
|---|---|---|---|
| `up` | **7** | the full rewrite | `route/empty` · `route/no-source` · `picker/build` · `text/too-much-text` · `look/no-look` · `look/needs-pages` · `page/no-look` |
| `addon` | **5** | the add-on route | `picker/addon` · `pages/addon` · `rules/no-backend` · `rules/no-meta` · `rules/no-tables` |
| `hop` | **4** | one paid hop sideways | `data/no-backend` · `data/no-meta` · `data/no-data` (→ `text`) · `picture/needs-place` (→ `page`) |
| `explain` | **24** | a sentence, nothing bought | everything else — **11 of them ours** |

- **`up` ONLY WHERE THE RUNG POSITIVELY ESTABLISHED THE CHANGE IS BEYOND IT
  AND A WRITER THAT REGENERATES PAGES IS THE DESIGNED NEXT STEP.** Everything a
  rewrite cannot be shown to solve is `explain`: a thing that is not there, an
  ask nobody could place, every failure of ours. **`no-lane` is `explain`** —
  the review's own proposed control named it a genuine `up`, and the owner
  overruled that in as many words (*"don't assume "no-lane" … proves a rewrite
  can safely solve the request"*). The router's *"every unclear case resolves
  to work"* is the build/ask/clarify decision and is UNCHANGED; this is the
  lane picker inside the edit route.
- **THE CLASS IS CARRIED BY THE CALL, BY CONSTRUCTION**: no `layer` is `up`,
  `layer: "addon"` is `addon`, any other layer is `hop` — the only three things
  `EditPoll.escalateAction` can do with an escalate.
- **THE ROUTE IS HELD TO THE TABLE BOTH WAYS** (`test/edit-failure.test.mjs`):
  every `escalate(` and `explain(` in the edit route — window
  `const escalate = (reason, extra) =>` → `return Response.json(merged);`,
  **4,064 lines**, whole-line comments blanked — must have a LITERAL first
  argument; the multiset of escalate (reason, class) pairs must EQUAL the
  table's climbing entries (**16 call sites, 16 entries**); every explain key
  (**29 call sites, 24 keys**) must be an `explain` entry and every `explain`
  entry used; `escalate: true` is produced ONCE (the helper). **A new escalate
  with no entry fails by existing**, which is exactly how the missing-page
  removal came to buy a rewrite: its comment said "an addon" and its escalate
  named no layer.
- **`explain(key, facts, extra)`** answers **422, or 503 when ours**, `{ok:
  false, error: <reason>, cost: 0, unchanged: true, ours, msg}`. The sentence
  is the table's (`failureMsg`) and is **RUNG-SCOPED** — asserted over all 24:
  none says *nothing on your site changed*, *haven't been charged*, *cost you
  nothing* or *nothing was changed*; every `ours` sentence says *this is on us*
  and no other does. **`unchanged: true` is the rung saying IT wrote nothing**;
  a rename whose first alias write landed passes `unchanged: false`.

**THE BROWSER STARTS THE REWRITE FROM AN ESCALATE AND FROM NOTHING ELSE.**
`editAnswer`'s refusal branch **never calls `fallback`**: its own `msg`, else
every refused step's (`partialSaid`), else `outcomeMessage('failed')`. **An
unreadable body and a dropped connection** (`siteEdit`'s catch) say
`unreadEditMsg()` — *"I couldn't read the answer to that change, so I can't
tell whether it went through"* — because a rewrite on top of an edit that may
have landed charges twice for one ask. Both used to fall to `fallback`.

**THE ALL-REFUSED MERGE** (the owner's second reproduction): **422**; `cost` is
the ledger's — `syncLedger.taken` on the synchronous path, **0 on the job path**
(the consumer's `edit_refund` returns everything a refused reply reserved) —
never a sum of the steps' own figures; `unchanged` **only when every step wrote
nothing** (`stepWroteNothing`: it said so, it was withheld, or it escalated —
every escalation returns before its rung writes); every `partial[]` entry
carries its step's own sentence, or `stepMsg` for a step that escalated (said
beside other steps, never acted on, since acting would do part of a message at
a price nobody saw) — **not every entry, though**: a step whose reply could not
be read (`body` null) or whose failure carried no `msg` and did not escalate
still arrives with none (read, not driven). The screen prints each distinct
sentence ONCE (two withheld page steps write the same one), two at most plus a
count, **and counts every step with no sentence beside them** — *the mixed
partial*, below.
- **UNANIMOUS CLIMB IS THE ONE EXCEPTION**: every step escalated to the same
  `layer|page` → the first step's escalate is the answer, acted on exactly as
  one step's would be (a site from before designs were stored, where every step
  needs the rewrite). Mixed is said step by step.

**WHAT THE EDIT COST AND WHAT THE ROUTING CALL COST ARE TWO AMOUNTS.**
`wholeRequestNote(e, d)` fires on `unchanged === true` (or the older `withheld`)
and says *"Nothing on your site changed, and this edit cost you nothing."* (or
*"…but this edit cost N credits."*) then, **when the browser still holds the
routing reply**, *"Reading your message cost N credit(s)."* — `d.cost`, which is
the routing reply's own `cost: rCost`, handed to the answer on BOTH paths
(`siteEdit` → `editAnswer`, `watchEditJob` → `reader`). **A watch resumed after a
refresh holds no routing reply and says nothing about it rather than a guess.**
`editBrowserReply(reply, httpOk, d)` takes that `d` now; absent, as every
earlier caller passes it, the screen is what it was.

**THE REPORTED CASES, THROUGH AN EXISTING CAPABLE PATH:**
- **data on an `incomplete` site** asks the four-state reader when the fast one
  answers `null` — `incomplete`/`ready` → the PROVEN connection, **nothing
  written** (no `PATCH site_backends`, asserted); `none` → a hop to `text`;
  `unreadable` → explained, ours — and the catalog-first `specForAddon` when
  `_meta` gives nothing (a confirmed-empty catalog is the same hop).
- **a photograph only in a component**: the picture rung reads
  `editableFiles(eSrc, parts)` and publishes `splitEditable`'s two halves — the
  text rung's 2026-09-11 fix, one rung over — **only when the parts store
  ANSWERED**; otherwise the pages go alone (the spine re-sends the store's copy,
  never `parts: []`), and a photograph then not found is `parts-unreadable`
  (ours), **never "your site has no photograph"**. A component slot is shown
  under `partPath(name)` = `-parts/<name>.tsx`.
- **a page that is not there** (both the lanes' `pages` verb and the page
  rung): removal is *already true*, a move has *nothing to move*, an edit lists
  the real pages and asks which. **Which page gets targeted is its own task.**
- **THE SOURCE READ**: a repairing read that answers nothing is asked again of
  the three-state reader to tell a read that THREW from an empty store — and
  **that second read only classifies**: pages it finds mean the repairing read
  blinked, and the answer is `route/no-source-unreadable`, never an edit of a
  copy nothing repaired. **`site-busy`'s census caught the first cut adopting
  them** (7 → 8 bare reads); it is argued there now, with the property asserted.

**⚠ THE 2026-09-20 CONTROL IS REVERSED, DELIBERATELY.** A genuine page
no-change was kept escalating (*"the site already does that"*, climb). It is
`page/no-change` now, a sentence at no cost: the page's own writer saw the page
and the request, and a rewrite of EVERY page is no evidence it would do better.
**The ladder's control moved** to `edit-failure.test.mjs`, where
`too-much-text`, `kind`, a unanimous `no-look` and an empty store still start
the rewrite, `three` still reaches the add-on, `data` with no database still
hops to `text` and `needs-place` to `page` — each through the route AND the
browser's own handler, so a fix that stopped escalating everywhere fails there.

**AND ONE MORE THAT NEVER REACHED A SCREEN**: *"your site doesn't have a QR
code, so there was nothing to take off"* answered `ok: true` with no layer, and
the success composer printed *"✅ Done."* over it. A refusal now
(`picker/nothing-to-remove`).

**EVIDENCE.** `test/edit-failure.test.mjs`, **33 cases**: the owner's two
reproductions, move and edit of a missing page, the mixed all-refused, no-lane,
look no-change, the reversed page no-change, three failures of ours (missing
key, unreadable store, a read that blinks once), the three data states, the
three picture states, and the controls — each asserting the stored bytes, the
response, the screen's exact sentence and the recorded follow-ups, plus
`sum(debits) === cost` wherever a charge is claimed. **Red 25 of 33 against the
unfixed `a018ad3e`** in a throwaway worktree; the 8 that pass there are the six
controls whose behaviour must not change and the two pure table checks. **One
targeted mutation** (the classifier adopting the pages again) killed, restored
byte-identical from a scratchpad backup. **No broad mutation campaign** (owner).
Every model answer is SUPPLIED and every case is the synchronous path.
**Pre-existing guards re-anchored to the property, not appeased**: `edit-path`
(no-lane, page-verb and a missing page's verbs are refusals with sentences, no
escalate); `edit-poll` (the refusal branch contains no `fallback(` call, its
observer proved alive; the catch landmark no longer names `err`);
`edit-page-protect` (a genuine no-change is said — the reversal — and the
wordless-partial count arm driven on a legacy reply, since the route no longer
writes one); `site-apply` (the escalating reasons that still climb, the four
that went are `explain`ed, the data lane resolves the four states, an unreadable
body and a dropped connection no longer buy a rewrite); `edit-rules-backend`,
`edit-nobackend`, `edit-parts`, `removal-door`, `site-picture`; `site-busy` (the
classifier, above); **`api-auth`** — see the next paragraph.

**⚠ THE FOCUSED SET MISSED A GUARD AND CI CAUGHT IT.** The local run was
KEYWORD-selected (files naming `escalate`, `editAnswer`, the harness, the source
readers …): **88 files, 2,680 / 2,680** on the committed tree. CI's full run on
`1f234090` (unit run **`35854168333`**) read **7,212 / 7,207 / 1 / 4**: the
failure was `api-auth`'s *"the picture layer's working balance moves as it
spends"*, which reads the picture block by BYTE OFFSET (900 bytes above
`runPictureEdit(`) and names none of the keywords. The new comment about the
rung's components pushed `let balance` past the 900 — **and its END landmark
(`pages: eSrc });`) had matched NOTHING since the call gained `model:
eQuickModel`**, so `slice(start, -1)` had been searching the rest of worker.js
all along: the byte-window trap in both of its halves at once. Re-anchored
landmark to landmark (`if (eLayer === "picture") {` → the next `if (!pOut.ok)
{`), both proved, and a `let` → `const` mutation of the balance now fails it
(restored byte-identical). **The whole suite then read 7,212 / 7,212 / 0 / 0
locally** (`duration_ms 126,927`). *A focused list selected by keyword is blind
to exactly the guards that read by position* — which is why a narrow list is
only ever believed for a green, never for completeness.

**CI, BOTH HALVES TAKEN.** Unit run **`35855079271` on `aa9728ef`** reads
**`# tests 7212 / # pass 7208 / # fail 0 / # skipped 4`** (`duration_ms
117,064`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips. **`site build` run `35854168288` on `1f234090`** (11:22:37 → 11:46:54Z,
**24m17s**, all twenty steps) read all twelve counts green out of its per-step
files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, kit-render /
kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1 = **12**; the
two known `##[error]` annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17)
TS2339`) each directly above their own `ok` lines; `site-build.mjs` **17m40s**.
`aa9728ef` fires no site build — it touches `test/api-auth.test.mjs` and the two
documents, none on that workflow's `paths` — and its product tree is
`1f234090`'s, so that run is the reading for both. **The stamp chain ends at
`aa9728ef`.**

**THE MIXED PARTIAL (the same day, the owner's browser-composer
reproduction).** `partial: [{layer: "page", msg: "The photo change was
refused."}, {layer: "look", error: "compile"}]` printed *"⚠️ The photo change
was refused."* — **byte-identical to a reply holding that one failure**, on the
refusal branch and after the tick alike. `partialSaid` counted steps with no
sentence only in the branch reached when NO step had one, so one explained step
made every unexplained one vanish. It now says the sentences as before
(deduplicated, two shown, the rest counted), then *"One more part of that
message didn’t go through. Ask for it again on its own and I’ll tell you why."*
— **"more" only beside a sentence**, so a reply of one kind alone reads
byte-identically to before. **The dedup is of SENTENCES**: two steps with none
are two failures, counted one by one even when their entries are identical.
**A composer reproduction, not a live failure**: whether the route has written
such a mix on a real message is not established.
- **Evidence.** `test/edit-failure.test.mjs` 33 → **35 cases** — a complete
  refusal and a partial success, each asserting the exact screen and the
  recorded actions (`[]`; `["refresh the credit balance"]`), with a one-failure
  control and both single-kind controls. **Red first**: both failed on the
  unfixed composer with the one-failure text as `actual`. **One targeted
  mutant** (every silent step counted as one) was killed by both — **and the 33
  originals all passed under it**, so the new cases are the only guard on that
  property; `chat.js` restored byte-identical from a scratchpad backup. Every
  test file that reads or runs `chat.js` (93): **2,876 / 2,876**. Whole suite
  locally: **`# tests 7214 / # pass 7214 / # fail 0 / # skipped 0`**,
  `duration_ms 116,962` — **+2 against 7,212**, exactly the two cases. Rendered
  in the real workspace chat (the real composer's text, the real `chat.js` and
  `styles.css`). **No `site build` run**: `public/` and this test file are on
  none of its `paths`, so there is no run at all, not a fast one.
- **CI, the same reading.** Unit run **`35897585399` on `3da0be16`** reads
  **`# tests 7214 / # pass 7210 / # fail 0 / # skipped 4`** (`duration_ms
  118,607`) — the TOTAL matches, `pass` differing by exactly CI's four skips —
  and all 35 of the file's cases were found passing **by name** in the
  downloaded log (the two new ones as `ok 1657` / `ok 1658`), with zero `not
  ok` lines. **The stamp chain ends at `3da0be16`.**

**SEPARATE NEXT TASKS — RECORDED, NOT STARTED** (owner: *"Record wrong-page
targeting, duplicate execution, content preservation and billing findings as
separate next tasks"*):
1. **Wrong-page targeting.** Review #6 (a section change through `look` lands on
   `/` via `fallbackPage`) and run 23's `/book` (the router naming a page from
   the sentence). A missing page is now SAID; choosing the right one is not
   fixed. **STARTED 2026-09-23 — the NAMED half is fixed, merged and deployed
   in deploy 2147** (*a named page reaches the page it names*, below); a
   message naming no page on a
   multi-page site still goes to the home page by the documented default.
2. **Duplicate execution.** Review #5: two page lanes (`components`+`tsx`,
   `shape`+`components`) push two page steps for one sentence — the all-refused
   reproduction still calls `write_tweak`/`write_pages` twice. **STARTED
   2026-09-23 — NEIGHBOURING page lanes are one page operation on the branch**
   (*one page operation for neighbouring page lanes*, below). Two page lanes
   with another rung's step between them still run the page rung twice,
   deliberately (that order is load-bearing), and are the recorded remainder.
   **THE REMAINDER IS FIXED TOO, ORDER KEPT** (*a page operation that
   succeeded is not run again*, below). **CLOSED 2026-09-23 by the owner after
   review (81 focused cases passing), merged and deployed in deploy 2148 —
   with the limit KEPT: every model answer in those cases is SUPPLIED, so what
   is closed is the route running one requested page change once, never a
   claim that a real model's first attempt applies the whole request.**
3. **Content preservation.** Review #7 (the page writer drops an unrelated
   section and publishes), #8 (the css lane drops an earlier rule), #9 (look +
   rename both land and the screen names only the look), and the full rewrite's
   missing photograph wall and `imageDirective(0)` on a photographed site.
   **#7 REPRODUCED 2026-09-24 through the route** (*the full page writer drops
   unrelated content silently*, below), the design revised on the owner's four
   points, and **BUILT ON THE BRANCH THE SAME DAY** (*the preservation check,
   built*, below) — merged and deployed in deploy 2151, no paid run. **It covers links
   and the site's own components only; plain-text and kit-only section loss
   stays OPEN**, and the judge's reading of a message is the model's, proven by
   no test here. **A GROUP asked for at once** (*"remove all links"*) was
   refused by it and is supported the same day (*a group asked for at once*,
   below), judge-declared and kind-checked — and after a shared-heading bypass
   the owner reproduced, **a declared group constrains its answer** (next
   section but one). **CLOSED AT CODE REVIEW BY THE OWNER 2026-09-24** (*"The
   87 focused tests pass, and both CI checks are green"*) and handed off for
   merge, **merged and deployed in deploy 2151** (*merged and deployed: the
   preservation check*, below). **Partial
   protection, not the edit path complete**: supplied model answers only.
   **AND THE PLAIN-TEXT HALF IS NARROWED, NOT CLOSED** — Codex's literal-text
   guard (`builder/page-prose.mjs`), merged and deployed in deploy 2158,
   refuses a full-page edit that loses parsed literal JSX prose the request's
   supported grammar did not authorise. Words from code, data, component props,
   other component files or CSS stay uncovered, and kit-only markup with no
   literal prose is still unseen; `docs/investigations/edit-text-preservation.md`
   holds the scope.
4. **Billing.** A refused rung stays charged when another step of the message
   succeeded (job path); direct writes (rows, DDL, aliases) land before the one
   publish and a failed publish refunds everything and says "untouched"; the
   routing call is never refunded; **pre-existing unscoped "nothing was charged"
   wording on other failure paths** (`modelDown`'s timeout, `compileMsg`,
   `editStopped`, `outcomeMessage('cancelled')`, the build-lease sentences,
   `NO_CONTAINER_MSG`); and refusals that collect a charge (nav `no-menu`, the
   rename refusals, data/rules `no-match`, picture `no-change`) report a `cost`
   the job path then refunds, so the stored reply disagrees with the ledger.
   **`compileMsg`'s `unbilled` half is FIXED (2026-09-25, from run 31), merged
   and deployed in deploy 2159**: see *a ledger refusal states the edit's
   charge and the routing charge apart*. **The edit route's half is fixed,
   merged and deployed in deploy 2160** (`908c12ee`, `90efa38d`, the consolidated
   milestone section): no edit failure sentence claims money; a finished job's cost is
   read off its own row; a refused step's charge is said beside the change
   that shipped; and a change that landed before a failed publish is named,
   never called untouched. **Still unchanged**: the build-lease sentences,
   `NO_CONTAINER_MSG` and the add-on's `lostPhotosMsg`; the routing call is
   still never refunded; and the two money paths still differ on a failed
   publish (the synchronous path keeps its collects, the job refunds
   everything, landed work included).
5. **Found on the way, out of scope**: the rename's SECOND alias write failing
   leaves the old name demoted and the new one unwritten (explained with
   `unchanged: false`; the half-moved state is not repaired); `siteRoute`'s own
   failure still falls to `go()` (the router, not the edit route) — **re-read
   2026-09-24**: `if (!r.ok || !d) return go();` and `.catch(go)`, so on a live
   site a dropped connection, a non-2xx or an unreadable routing answer starts
   the full rewrite of every page with nothing shown and no price —
   **REPRODUCED THE SAME DAY through the real handler, BUILT THE SAME DAY, and
   merged and deployed in deploy 2152** (*a routing answer that cannot be acted
   on stops a live site*, below); and an
   add-only wall or page-verb answer in the look door ends the WHOLE message —
   *"add a QR code and make the footer navy"* goes to the add-on and the css
   lane never runs.
6. **The page verbs bleed into sibling page steps** (found 2026-09-23 while
   reproducing #2). `eRemove` and `eRename` were MESSAGE-WIDE `let`s the
   `pages` verb set, and every page step read them — so `shape` picked beside
   `pages` (*"…and take the gallery page off"*) ran the `shape` step down the
   REMOVAL branch: no page writer, `/gallery` removed, the layout never made.
   **CLOSED 2026-09-23 by the owner after review (251 focused and regression
   tests passing), merged and deployed in deploy 2149** (*a page verb belongs to
   its own step*, below): aimed at a NON-home page the same sentence had DELETED
   that page too, with *"✅ Updated the look."* on the screen, and the router's
   own `remove` reached a layout lane through the picture door. **The limit is
   KEPT**: every model answer in the evidence is SUPPLIED, so what is closed is
   the route scoping each verb to its own step and target — never that a real
   picker names these lanes or a real writer makes the layout change.
7. **An adopted site with no page list builds a NEW site** (recorded
   2026-09-24 for later — owner: *"Keep the separate missing-page-inventory/
   new-build issue recorded for later"*). A site opened on a browser that did
   not build it has no page list until `/api/site/routes` answers, asked once per
   load and never retried, so `isBuild` is true and the message routes as a
   FIRST build with `hasSite: false`: a failed routing call, a `build` answer, and
   `edit`/`addon` (closed off without `hasSite`, so they fall to `build`) all end
   in `react-build` with the project's chat, `siteForChat` finds no row, and a
   fresh paid site is named. **Driven for the failure door only**
   (`test/site-route-failure.test.mjs`); the answer doors are read hop by hop
   (*router side*, above). **REPRODUCED END TO END 2026-09-24 in a real browser
   with every request recorded, and the correction PROPOSED, not built** —
   *an existing site whose page list has not loaded is built as a new site*,
   below: a new paid build, the wrong site, and the request lost, all three.
   **BUILT THE SAME DAY** (*an existing site waits for its page list*, below),
   with the clarify doors the owner added, **and CLOSED by the owner after an
   independent review (260 focused tests), merged and deployed in deploy 2153**
   (*merged and deployed: the existing-site entry and the composer drafts*,
   below).
8. **The addon's own failures fall to the full rewrite** (found 2026-09-24,
   driven): a valid addon answer whose addon POST drops, or whose reply cannot
   be read, starts `react-revise` — on top of an addon that may have landed.
   `siteAddon`'s `.catch(fallback)` and `addonAnswer`'s `fall()`; the
   double-charge shape `siteEdit`'s catch was fixed for on 2026-09-23. Kept out
   of the routing correction. **REPRODUCED IN FULL 2026-09-24 — 25 of 31 shapes
   start the rewrite; the scope is proposed and nothing is built** (*the
   add-on's own failures buy the full rewrite — reproduced*, below). **BUILT
   THE SAME DAY, merged and deployed in deploy 2154** (*an add-on that fails
   never buys the rewrite*, below). **The add-on route's own escalates naming no layer
   still climb to the rewrite** — the separate server-side step — so not every
   automatic rewrite from an addition is closed. **AND ITS REPLIES ARE
   VALIDATED BEFORE THEY ARE TRUSTED** (the owner's second round the same day,
   merged and deployed in deploy 2154: *an add-on reply is validated before it
   is trusted*, below) — a well-formed no-layer escalate still climbs; a
   malformed one stops.
9. **A routing call that cannot be acted on drops the attachments** (found
   2026-09-24, driven through the entry harness on `c5c93652`): `siteRoute`'s
   `lost()` stops with *"…Send it again in a moment"*, and the files `siteSend`
   took off the composer are held nowhere — strip empty, and the resend's logo
   edit posts no image. On any live site, page list loaded or not, and on an
   existing site's round, which is cleared before routing. The same loss the
   pre-routing stop had (*a message the page-list check stopped keeps its
   files*, below), one step later; that correction's hold is the mechanism,
   and the owner scoped it to the pre-routing check. **Fixed 2026-09-25,
   merged and deployed in deploy 2160** (`9e70f093`): `lost()` holds the message on its
   origin site through the same hold.
10. **The edit reader trusts a reply by truthiness** (found 2026-09-24, driven
   through the real handler on `f1dadcdc`'s `chat.js`, straight back AND
   queued): a 503 escalate naming the add-on posts the paid add-on; one naming
   a layer posts another paid edit; one naming no layer starts the rewrite;
   `escalate: "false"` naming a layer posts another edit; `{ok: "false"}`
   prints "✅ Done.". `editAnswer` reads `e.escalate` before `httpOk`, and
   `!e.ok`. The add-on's own reader was closed for exactly this class (*an
   add-on reply is validated before it is trusted*, below); the owner's report
   and rule were the add-on's, so this one is recorded, not changed. **The
   owner reproduced the first and the last independently, and it was BUILT THE
   SAME DAY and merged and deployed in deploy 2155** (*an edit reply is
   validated before it is trusted*, below) — the add-on's rule shared, not
   copied.
11. **A hop that succeeds leaves the site's edit latch held** (found 2026-09-24
   while validating the edit reader, driven through the real handlers on
   `fd27cc9f`): `siteEdit`'s `editInFlight` is released only by the FIRST
   POST's own `clearFlight`. A sideways hop deliberately does not release it
   (`escalatedEdit`: *"THE LATCH IS NOT CLEARED HERE"*), and the hop's own POST,
   `handedOff`, never touches it. So once a hop lands — `data` → `text`,
   `picture` → `page` — the site stays latched for the rest of the page load:
   the next edit message pays for its routing call, `siteEdit` returns before
   posting, nothing is said, and the send box stays busy with the rail running.
   Driven: message 1 hopped and said *"✅ Updated the wording."*; message 2's
   requests were the routing call alone, busy true, rail running. A reload
   clears it. **The owner reproduced it independently and took the fix: BUILT
   THE SAME DAY, merged and deployed in deploy 2155** (*a site's edit latch is
   held for exactly as long as its ask*, below) — and reproducing it found the other
   half: a queued edit, and an edit handed to the add-on, released the latch
   while the work was still running.
12. **The one-hop bound is not enforced on the queued path** (found 2026-09-24
   while fixing #11, driven through the real handlers on `4b849501`):
   `watchEditJob` hands its reader `handedOff: false` whatever the job was, so a
   hop whose reply arrives QUEUED may hop again. A synchronous hop whose queued
   reply escalates to `page` posted edits at `data`, `text`, `page`; a fully
   queued chain alternating `text`/`page` posted `data`, `text`, `page`,
   `text`, `page` — while the synchronous control goes up to the rewrite.
   **Unreachable today**: only `data` (→ `text`) and `picture` (→ `page`) hop
   in `builder/edit-failure.mjs`, and neither target has a hop entry. It
   becomes live the day one does. Not changed here. **CLOSED by the edit-path
   milestone, merged and deployed in deploy 2158**: the job record carries a
   strict `handedOff` boolean through the queue and a reload, and the watcher
   hands it to the shared reader (controlled tests in `edit-lock`).
13. **A throw after an edit's sentence is out says a second sentence and lowers
   the busy flag** (found 2026-09-24 writing #11's stale-completion case,
   driven): a redraw that throws inside `finish` propagates to `siteEdit`'s
   POST catch, which says *"I couldn't read the answer to that change…"* as a
   SECOND reply through the same `finish` — clearing the page's busy flag while
   whatever runs next is still running. The add-on closed this class with its
   `tell` latch (*an add-on that fails never buys the rewrite*); the edit path
   has no such latch. The per-ask latch keeps the site held in that state
   (asserted); the double sentence and the lowered flag are recorded, not
   changed. **The owner then reproduced the QUEUED form — a stored success
   whose application throws: no reply, busy for good, latched — and took the
   fix: BUILT THE SAME DAY, merged and deployed in deploy 2155** (*a published
   edit this page fails to show is still a published edit*, below). Every sentence
   through `siteEdit` now ends its POST once. **Left open then**: a QUEUED
   non-success sentence whose redraw throws after it is out escaped the watcher
   as an unhandled rejection — one sentence, the page freed, the latch released
   — as the add-on's queued refusal did. **CLOSED by the edit-path milestone,
   merged and deployed in deploy 2158**: `watchEditJob` wraps its `finish`, so
   a redraw failure after the terminal state is recorded stays inside the
   watcher (controlled tests only).

### MERGED AND DEPLOYED: THE FAILURE HANDLING (2026-09-23, evening)

Owner: *"Close this correction. Merge and deploy the reviewed failure-handling
changes, preserving anything newer on main. Report the actual deployed SHA and
container image. No paid replay is needed for this deterministic reporting
correction."*

- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `0d5137f0` →
  **`3c0a2533`**, 10 commits, 20 files (+3,079 / −210): the classification
  table, the browser's refusal handling, the mixed-partial count, their guards
  and the documents. Asked before the push: zero runs in progress or queued,
  the image id predicted over both ends (the seventeenth cross-check, above),
  and the rollback verified in a throwaway worktree — reverting the range gives
  tree `3ccf15bf…`, **main's own**, so a rollback reuses `ce67f25d132667d0`.
- **DEPLOY 2146 (`35901168665`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  18:15:12 → 18:18:29Z. `DEPLOY_ID` `3c0a25335c4f6fbd3ae506999e51c1ff3e29d357`
  (masked in the log as `…e5***c***ff3e29d357`); image **built
  `fd3355f0b71af621`** (404, 185 inputs) and **rolled from
  `ce67f25d132667d0`**; `Uploaded isibi-app`, a fresh Worker version,
  `Deployed isibi-app triggers`.
- **THE SERVED-FILE CHECK, BOTH READINGS TAKEN**: `public/` changed, so
  Wrangler answered `+ /chat.js`, 1 file, 85 already uploaded. **Before**
  (taken before the deploy landed): 732,238 bytes, sha256 `903d9ff39b7d4b1d`,
  0 occurrences of `unreadEditMsg`. **After**: 736,749 bytes, sha256
  `bf745e7118484cad`, 3 occurrences — **byte-identical to `git show
  3c0a2533:public/chat.js`**. Gates **401 / 401 / 401 / 404** at 18:20:15Z.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `3c0a25335c4f6fbd3ae506999e51c1ff3e29d357` and `expect_image`
  `fd3355f0b71af621` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token.

### A NAMED PAGE REACHES THE PAGE IT NAMES (2026-09-23, merged and deployed in 2147)

Owner: *"Reproduce a request explicitly targeting /gallery on a two-page site
that passes through look → page. Trace where the requested page is lost and
why the dispatcher falls back to /. Preserve the explicit target through
routing and dispatch. A named page must resolve to that page or produce a
clear missing/ambiguous-target response; it must not silently become the
homepage."* **Not merged, not deployed, no paid run.**

**THE PAGE WAS LOST AT THE FIRST OF FOUR HOPS, AND THE OTHER THREE WERE
STARVED.** `route_message`'s `page` field said *"Only when layer is page"*, and
`readEdit` returned for every other layer before it read the field — so a
`look` answer arrived with no page whatever the model wrote. `/api/site/route`
forwards `routed.page` for ANY edit, `siteEdit` posts `d.page` for ANY layer,
and the look door already preferred a named page (`fallbackPage = ePage || …`);
with `ePage` always empty the fallback chose the site's only page, else `/`.
**Reproduced through all four hops with supplied model answers, red**: the
router named `/gallery`, the routing reply had no page, the browser posted
`page: ''`, the writer was shown `index.tsx`, the home page changed, the gallery
did not, and the screen said *"✅ Updated /."* A page the site does not have
(`/menu`) went the same way — made on the home page, reported as done.

**THE FIX IS THREE SMALL CHANGES:**
1. **The router may name the page on `look`** — the field's description says
   when (the page they SAID, copied from the list; never guessed; absent for a
   whole-site change), and the look layer's description says to fill it.
2. **`readEdit` keeps it for `look`**, in `normalizePagePath`'s spelling; absent
   stays absent (no key), and every other non-page layer still carries none.
   **A page the site does not have is KEPT, not turned into an add-on** as the
   page layer's is — a colour or a section aimed at a missing page is not an
   addition, and *"take the 3D thing off the menu page"* must not design one.
3. **The look door checks a named page before anything runs** — before the
   picker is paid for or any lane acts — and answers a missing one with the page
   rung's own `page/no-page` key and sentence and the site's real pages: 422,
   cost 0, `unchanged`, nothing compiled, no follow-up. So no site-wide lane can
   quietly change the whole site for a page that is not there, and no page-shaped
   lane can land on the home page instead.

- **THE DEFAULT IS KEPT AND PINNED**: a look message naming NO page on a
  multi-page site still goes to the home page (`fallbackPage`'s documented
  rule). The owner's rule is about a named page; a control asserts the default so
  the fix cannot pass by refusing every unnamed page change.
- **⚠ ONE CONSEQUENCE BEYOND THE REPRODUCED CASE**: the `pages` verb's step used
  `pv.name || fallbackPage`, and the fold for a `removes: ["pages"]` answer
  names `ePage`. Both were written to take a named page and never received one;
  now a page verb the picker answers WITHOUT naming a page acts on the page the
  router named, where it used to fall to `/` (whose removal is refused). That is
  the rule applied consistently and it is NOT separately tested — the picker's
  own `pageName` still wins when it gives one.
- **WHAT DID NOT MOVE**: the css lane (and every other own lane) ignores the
  page, so a colour change *"for one page"* is still written into the site-wide
  sheet exactly as before; the page layer's own unknown-page → add-on rule; the
  routing reply, `siteEdit` and the dispatcher, all unchanged.

**EVIDENCE.** `test/edit-page-target.test.mjs`, **5 cases**, every hop DRIVEN:
the real `/api/site/route`, the real `siteEdit` cut out of `chat.js` and run
with a recording `apiFetch`, the real edit route on the exact body `siteEdit`
posted, and the real browser composer. The writer stub **obeys whatever file it
is shown**, which is what makes a wrong target visible. Asserted: the routing
reply's page, the posted page, the writer's file AND its whole source (and the
home page absent from its prompt), the model calls, the compiler payload, the
stored pages, the edit's debits against its reported cost, the screen, and the
home page **byte-identical** in both the payload and the store. Controls: `/`
named explicitly (the positive homepage edit), and no page named (the default).
**Red 4 of 5 against unfixed `3c0a2533`** in a throwaway worktree — only the
unnamed-default control passes on both. **Focused mutation check
`scripts/mutants/page-target.json`: 9 mutants, 9 killed, 0 survived, 0 never
applied, the comment-only control surviving**, one mutant per hop or fact (the
router dropping the page, its spelling, the routing reply, the browser POST, the
door check, the dispatcher, the sentence's verb and its page list, the tool
text); the three swept files byte-identical to a scratchpad backup afterwards.
**Suite 7,219 locally, taken twice** (`# tests 7219 / # pass 7219 / # fail 0 /
# skipped 0`, `duration_ms` 116,888 and then 116,312 on the committed tree) —
**+5 against 7,214**, exactly this file's cases.
**AND THE CI UNIT HALF MATCHES**: run **`35904011295` on `807d88b8`** reads
**`# tests 7219 / # pass 7215 / # fail 0 / # skipped 4`** (`duration_ms
118,875`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all five cases found passing BY NAME (`ok 1807`–`ok 1811`) and
zero `not ok` lines in the downloaded log.
**AND `site build` run `35904011369` on `807d88b8`** (18:39:48 → 19:05:25Z,
**25m37s**, all twenty steps) read all twelve counts green out of its per-step
files, the flat log agreeing line for line: TAP 397/397/0/0, kit-typecheck 4,
site-build **382**, contrast-cases 16, theme-seam 11, theme-render 29,
site-routing 14, site-runtime 47, kit-render / kit-a11y / kit-effects /
kit-paint `all passed`, census 7 + 4 + 1 = **12**; the two known `##[error]`
annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the
case that compiles a broken page on purpose, `tsc`-format lines 9 / 2 / 7;
`site-build.mjs` **18m22s**. **⚠ THE SECOND ANNOTATION IS NOT DIRECTLY ABOVE
ITS `ok` LINE THIS TIME**: the two known `SSR stream transform exceeded maximum
lifetime` lines landed between them, where run `35854168288` printed them after
the `ok` lines. That is the order asynchronous output reached the log, not a
change in what passed — its own `ok` (*"a site with one bad page still reports
the type error"*) follows two lines later — so read what an annotation sits
INSIDE rather than what line happens to follow it. `dc3f8efc` fires no site
build (the two documents only), so this run is the reading for the branch.
**The stamp chain ends at `807d88b8`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED, so this proves a
page the router names is carried to the writer and published there — never that
a real router names it. The router's instructions changed; whether the model
fills the field is unproven until a live run.
**⚠ A MEASURED LIMIT, SHARED WITH THE PAGE RUNG**: a named page is compared
LOWERCASED (`readEdit` normalises it) against `routeOf`, which KEEPS case
(`About.tsx` → `/About`), so a capitalised route file would be refused as
missing — by the new door check, and already by the page rung's own lookup.
**Measured: 0 capitalised routes** across the 324 corpus pages, the 8 generated
fixtures and 53 live routes on 25 sites' sitemaps, so it is recorded rather than
built for.

### MERGED AND DEPLOYED: THE NAMED-PAGE CORRECTION (2026-09-23, evening)

Owner: *"Keep the claim precise: a target supplied by the router now survives
through publication; real-model target selection remains unverified. Merge and
deploy this reviewed correction, preserving newer main changes. Report the
actual deployed SHA and image. No paid replay yet."*

- **THE CLAIM, IN THE OWNER'S WORDS**: **a target supplied by the router now
  survives through publication; real-model target selection remains
  unverified.** The reviewed evidence is the 40 focused cases, unit CI and the
  site build — all on SUPPLIED answers.
- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `3c0a2533` →
  **`90045638`** at ~19:25Z, 3 commits, 7 files (+784 / −15). Asked before the
  push: zero runs in progress or queued, the image id predicted over both ends
  (the eighteenth cross-check), and the rollback verified in a throwaway
  worktree — reverting the range gives tree `6eed00f2…`, **main's own**, so a
  rollback reuses `fd3355f0b71af621`.
- **DEPLOY 2147 (`35909174705`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  19:25:10 → 19:28:17Z, **3m07s**; image step **2m15s** with **0 `CACHED`
  lines**; Wrangler 18s. `DEPLOY_ID` **`9004563879727638d4db6405e7560c7a2700ab03`**
  (unmasked in the log); image **built `1aba925de4658f45`** (registry answered
  404, 185 inputs — the log prints `***aba925de4658f45`, the `***` a masked
  `1`) and **rolled from `fd3355f0b71af621`** (`- …:fd3355f0b7***af62***` →
  `+ …:***aba925de4658f45` under `SUCCESS Modified application`, `Applied
  changes`); `Uploaded isibi-app`, `Current Version ID: 54890ba0-…`, `Deployed
  isibi-app triggers`. **`No updated asset files to upload`** — `public/` did
  not change — so there is **no served-file check**. Gates **401 / 401 / 401 /
  404** at 19:28:49Z.
- **THE EIGHTEENTH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `fd3355f0b71af621` (what deploy 2146 rolled to) and
  the tip `1aba925de4658f45`, both from 185 inputs, three of the push's seven
  files among them (`builder/edit-failure.mjs`, `builder/site-ask.mjs`,
  `worker.js`) — re-read over the deployed range afterwards, same answer.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `9004563879727638d4db6405e7560c7a2700ab03` and `expect_image`
  `1aba925de4658f45` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

### ONE PAGE OPERATION FOR NEIGHBOURING PAGE LANES (2026-09-23, merged and deployed in 2148)

Owner: *"Reproduce one look request whose selected fields include shape and
components, both targeting the same page. Measure how many page-writer calls,
compilations and charges it causes, and whether the second execution repeats
or reverses the first. For compatible changes to the same page, prepare one
page operation carrying both requested changes. Preserve genuinely different
page targets and operations that require separate ordering."* **Merged and
deployed in deploy 2148 (below); no paid run.**

**THE REPRODUCTION, THROUGH THE REAL ROUTE WITH SUPPLIED ANSWERS.** A two-page
site, `shape` + `components` both landing on `/`, both money paths. The writers
are stubs that apply the request to the file they are SHOWN, which is what
makes a repeated execution visible:

| the ask | page-writer calls | compiles | what shipped | charged | screen |
|---|---|---|---|---|---|
| a swap (*"swap the opening hours and the market times"*) | **2**, the second shown the first's swapped page | 1 | the **ORIGINAL** page — the second run swapped it back | **3 + 2** (`use_credits`); job path `edit_reserve` seq 1 = 3, seq 2 = 2 | *"✅ Updated the look."* |
| a placement (*"put the market times at the top"*) | **3** — the second run's cheap writer found nothing to do, then its full writer returned the page unchanged | 1 | the change | 3 (the second run's two calls unbilled: our cost) | *"✅ Updated /. ⚠️ I read the / page and couldn't find a change to make for that…"* |

Controls — `shape` alone, `components` alone, and `shape` alone on the job
path: 1 writer call, the change shipped, 3, *"✅ Updated /."* The unrelated
gallery was byte-identical in every run.

- **SO THE SECOND EXECUTION DOES BOTH, DEPENDING ON THE ASK**: it REVERSES a
  change whose second application undoes it, and REPEATS one whose second
  application finds nothing to do — and then reports a refusal beside a change
  that shipped. Either way somebody pays for it and the screen is wrong.
- **THE CAUSE**: the look door pushed one step per dispatched lane —
  `purpose`, `components`, `shape`, `three` and `tsx` all dispatch to the page
  rung — and the page rung reads the customer's SENTENCE and none of the lane
  names (`runLayer` hands it `fields`; the page branch reads none of them). Two
  such steps are one operation run twice, the second on the first's output
  because `publishStep` advances `eSrc`.

**THE FIX IS ONE PURE FUNCTION AT THE ONE PLACE THE STEPS ARE MADE.**
`mergePageSteps` (`builder/site-lanes.mjs`) joins CONSECUTIVE page steps aimed
at the SAME page, each with no ask of its own and every field a lane that
dispatches to the page rung by its own name, into one step carrying every field
in order. The look door applies it to the dispatched steps alone
(`steps.push(...mergePageSteps(dispatched))`), so the QR placement step and the
`pages` verb step — pushed separately — never meet it.

- **WHAT NEVER JOINS, each a different operation rather than the same one
  twice**: a step with its OWN ask (the QR placement's fixed text); a `pages`
  verb step (`laneLayer("pages")` is null — the verb decides the rung); a step
  on a DIFFERENT page; and **two page steps with ANOTHER rung between them**.
  The last is the owner's *"operations that require separate ordering"*:
  joining them moves one page change across that rung, and the order is
  load-bearing — the picture rung's work reaches a later page step through
  `eSrc`, which is what the photograph protection reads, and a page step run
  first can be withheld for a loss the picture rung was about to authorise.
  **No step moves; neighbours are joined.**
- **AFTER, SAME ROUTE, SAME ANSWERS**: a swap-plus-card ask on `shape` +
  `components` → **1** writer call shown the stored page, **1** compile carrying
  BOTH changes, both in the store, the gallery byte-identical, **one debit
  equal to the one-lane control's**, `lanes: ["components", "shape"]`,
  `layers: ["page"]`, *"✅ Updated /."*; the job path takes **one**
  `edit_reserve` (seq 1). The placement ask: one call, no false refusal.
- **THE REMAINDER, STATED**: two page lanes with another rung's step between
  them — `components` + `images` + `tsx` — still run the page rung twice, and
  the second execution still repeats or reverses the first. Kept deliberately
  for the ordering above. **FIXED ON THE BRANCH THE SAME DAY, ORDER KEPT** —
  *a page operation that succeeded is not run again*, below.
- **AND A SEPARATE DEFECT FOUND ON THE WAY — THE VERB BLEEDS** into sibling
  page steps (next-task 6 above). Unchanged by this fix.

**FOUR PRE-EXISTING CASES WERE BUILT ON THE DEFECT'S SHAPE, AND EACH WAS
RE-ANCHORED TO WHAT IT ASSERTS**, not appeased:
- `edit-failure`'s owner reproduction (two page steps both withheld): the same
  input is ONE page step now — its own 409 refusal, its sentence at the top —
  and **the screen is byte-identical to what the merge was fixed to say**: the
  sentence once, the whole-request clause, no follow-up. The merge's
  all-refused law moved to a new case on `components` + `images` + `tsx`: two
  page steps answering *no change* beside the picture rung finding no
  photograph — 422, three entries, the repeated sentence printed ONCE. File
  35 → **36 cases**.
- `edit-page-context`'s snapshot case and `edit-page-protect`'s two
  merge-reporting cases moved to `components` + `images` + `tsx`, the shape that
  still runs two page rungs, each with its premise asserted (two page rungs,
  the picture rung between them). **Moved again by the next section**, whose
  fix makes that shape run one page operation too.

**EVIDENCE.** `test/edit-page-once.test.mjs`, **7 cases**: the reproduction
fixed on the synchronous path and on the job path, the placement shape, the
single-lane controls, the ordering case (the picture rung's call sits between
the two page calls, and the second is shown the first's output), and two unit
cases driving `mergePageSteps` over every joining and non-joining shape. **Red
3 of 7 against unfixed `90045638`** in a throwaway worktree (only the new
function copied in, so the file loads) — the three route cases, each on its
first gate (*the page writer ran more than once*); the controls, the ordering
case and the rule cases pass on both. **And each layer sees the defect on its
own**: with the call-count gate cut in the throwaway copy the same cases fail
on the published page (the swap lost), and with that cut too, on money
(`[3, 2]` debited; seq 1 = 3, seq 2 = 2 reserved). **Focused mutation check
`scripts/mutants/page-once.json`: 8 mutants, 8 killed, 0 survived, 0 never
applied, the comment-only control surviving**, against the eight edit-path files
that can see the change (the new file, `edit-failure`, `edit-page-context`,
`edit-page-protect`, `edit-lanes`, `edit-parts`, `site-apply`,
`edit-page-target`); both swept files byte-identical to a scratchpad backup
afterwards. **Suite 7,227 locally** (`# tests 7227 / # pass 7227 / # fail 0 /
# skipped 0`, `duration_ms 117,122`) — **+8 against 7,219**, exactly this
change's cases: seven in the new file and one in `edit-failure`.
**AND THE CI UNIT HALF MATCHES**: run **`35912468500` on `7ee2e427`** reads
**`# tests 7227 / # pass 7223 / # fail 0 / # skipped 4`** (`duration_ms
119,331`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all nine new or renamed cases found passing BY NAME (`ok
1632`–`1633` in `edit-failure`, `ok 1766`–`1772` in the new file) and zero
`not ok` lines in the downloaded log. **AND `site build` run `35912468693` on
`7ee2e427`** (19:55:00 → 20:19:35Z, **24m35s**, all twenty steps) read all
twelve counts green out of its per-step files: TAP 397/397/0/0, kit-typecheck
4, site-build **382**, contrast-cases 16, theme-seam 11, theme-render 29,
site-routing 14, site-runtime 47, kit-render / kit-a11y / kit-effects /
kit-paint `all passed`, census 7 + 4 + 1 = **12**; the two known `##[error]`
annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) each
directly above its own `ok` line this time, `tsc`-format lines 9 / 2 / 7;
`site-build.mjs` **17m58s**. **The stamp chain ends at `7ee2e427`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED and every writer is
a stub that applies the ask to what it is shown, so this proves the route runs
ONE page operation, publishes both changes and bills once — never that a real
model applies two changes correctly in one call.

### A PAGE OPERATION THAT SUCCEEDED IS NOT RUN AGAIN (2026-09-23, merged and deployed in 2148)

Owner, after reproducing the recorded remainder independently through the
route with supplied answers (`components` + `images` + `tsx`, the picture step
failing, `write_tweak` twice, debits `[3, 2]`, the swap reversed, *"Updated the
look"* naming only the picture failure): *"Preserving step order is necessary,
but replaying the full request and undoing its result is still incorrect. …
Ensure the same requested page change is not applied twice across an
intervening step. Preserve genuine picture dependencies and ordering; do not
blindly merge across them."* **Reviewed and CLOSED by the owner (81 focused
cases passing), merged and deployed in deploy 2148 — the next section. No paid
run; the supplied-answer limit is kept.**

**THE REMAINDER, REPRODUCED ON BOTH MONEY PATHS BEFORE THE FIX** (this file's
harness in `test/edit-page-once.test.mjs`, one page, a reframe as the
successful picture change):

| picture step | page-writer calls | what shipped | charged | screen |
|---|---|---|---|---|
| fails (its model unreachable) | **2**, the second shown the first's output | the swap **undone**, the card kept | **3 + 2** (reserved 3, then 2) | *"✅ Updated the look. ⚠️ I couldn't reach the model that picks the picture — try again in a moment."* |
| succeeds (a reframe) | **2** | the swap **undone**, the reframe kept | **3 + 1 + 2** (reserved 3, 1, 2) | *"✅ Updated the look."* — a success sentence over a lost change |

**THE FIX IS ONE RULE AT THE STEP LOOP, AND IT MOVES NOTHING.**
`pageStepDone(step, done)` (`builder/site-lanes.mjs`): a page step running the
customer's sentence, on a page where an earlier such step already SUCCEEDED,
is not run; its lanes are folded onto the step that did the work, so `lanes`
still names every one. The steps keep their order and nothing is merged across
the picture step.
- **SKIPPED ONLY AFTER A SUCCESS, AND ONLY A RECORDED ONE** (`failed ===
  false`). An earlier step that was withheld or failed leaves the request
  undone, and the later step completes it — on the state the picture rung left,
  which is the dependency the order exists for. An entry that cannot say lets
  the later step run: cannot-tell degrades to the old path, never to dropped
  work.
- **ONE DEFINITION OF "THE SAME OPERATION"** — `samePageOperation`: both steps
  the page rung on the customer's sentence (no ask of their own, every field a
  page lane) on the same page. Asked by `mergePageSteps`, `pageStepDone` and
  the supersede below; the adjacent merge's arrow predicate moved into it
  unchanged (`sentencePageStep`).
- **AND THE MIRROR, FOUND BY THE DEPENDENCY CONTROL.** When a later attempt of
  the same operation SUCCEEDS, the earlier attempt's refusal is **superseded**:
  kept in `done` (its lanes and its cost stay on the reply), dropped from
  `failures`. **Measured on HEAD and pre-existing, not caused by the skip**: the
  dependency case — first page attempt withheld for a photograph, the picture
  step takes it off, the second attempt ships the swap — printed *"⚠️ I
  couldn't make that change … so I didn't make it"* beside the change that
  shipped. **Superseded only by the same operation**: a picture step that fails
  BEFORE a page step that ships stays on the screen (a control).

**AFTER, SAME ROUTE, SAME ANSWERS, BOTH MONEY PATHS:**
- **picture FAILS** → **1** page-writer call (shown the stored page), then the
  picture step; the swap once and the card; the photograph untouched; debits
  **`[3]`**, reserved **`seq 1: 3`**; `layers ["page"]`; *"✅ Updated /. ⚠️ I
  couldn't reach the model that picks the picture — try again in a moment."*
- **picture SUCCEEDS** → 1 page-writer call, then the reframe; the swap once,
  the card, `focus="top"` kept; debits **`[3, 1]`**, reserved **`3, 1`**;
  `layers ["page", "picture"]`; *"✅ Updated the look."*
- **both are asserted EQUAL to `components` + `images`** — the same
  publication, the same bill, the same refusals, the same screen — because a
  page lane after the picture lane adds no page operation.
- **the DEPENDENCY** → page (withheld, 409, cost 0), picture (takes the bench
  off), page (runs, shown the picture step's result, ships the swap once);
  debits **`[2, 2]`**, reserved **`2, 2`**; no refusal on the reply;
  *"✅ Updated the look. One photograph is no longer on the site. If that was
  not what you wanted, say "put the photo back". There is a space for a photo
  — upload yours in the Data panel and it'll fill in."*

**THREE PRE-EXISTING CASES DROVE TWO SUCCESSFUL PAGE RUNS ACROSS THE PICTURE
STEP — the shape this fix makes unreachable — and each moved to a shape that
still carries its property, re-anchored rather than appeased:**
- `edit-page-context`'s snapshot case → `components` + `images`, the page step
  changing `card-a` and the picture step reframing a photograph inside
  `card-b`. The picture rung reads `editParts()` and hands every component to
  `publishStep`, so without the snapshot's advance it republishes the stored
  `card-a`. **Probed: cutting the advance fails it** (*"the picture step handed
  over the stored one"*), `worker.js` restored byte-identical from the
  scratchpad.
- `edit-page-protect`'s withheld-component case → `images` + `tsx`: the picture
  step reframes first and the page step, second, withholds `card-b` — the
  look-shaped merge with the warning on the LATER rung, and the screen naming
  it.
- `edit-page-protect`'s frame case → `components` + `images`: the page step
  leaves an empty frame and the picture step fills it with the owner's upload;
  the publication has none and the reply says none. Renamed *"an empty frame a
  LATER rung filled is not reported"*; the test bucket learned to list uploads.
- **`edit-failure`'s all-refused case is UNCHANGED**, and correctly: both of its
  page steps answer *no change*, so the first did not succeed and the second
  still runs.

**EVIDENCE.** `test/edit-page-once.test.mjs`, **10 cases**: the old ordering
case replaced by three route cases — the picture step failing, succeeding, and
the dependency with its different-operation control — each on both money
paths, plus one unit case for the rule. **Red 3 of 40 against HEAD's route**
across the three touched files (the new helpers copied into a throwaway
worktree so the file loads), each on its own gate: the owner's two on *"the
page operation ran again after the picture step"*, the dependency on *"the
superseded refusal was reported beside the change that shipped"* — its calls,
layout and charges PASSED on HEAD, so the order was always right and only the
reply was wrong. **Focused mutation check `scripts/mutants/page-replay.json`: 10
mutants, 10 killed, 0 survived, 0 never applied, the comment-only control
surviving**, against the eight edit-path files that can see the change; both
swept files byte-identical to their pre-sweep hashes afterwards. One comment
in `site-lanes.mjs` was reworded after the sweep, proved comment-only by a diff
against the swept copy, and the eight files re-run green (**193 / 193**).
(`page-once.json`'s
anchors name the arrow predicate that is now `sentencePageStep`; the ask and
field rules are re-covered here, R-5 and R-6.) **Suite 7,230 locally, taken twice** (`# tests 7230 / # pass 7230 / # fail 0 /
# skipped 0`, `duration_ms` 117,572 and then 117,219 on the final tree, after
the comment rewording) — **+3 against 7,227**, exactly this change's net cases:
the file goes 7 → 10, and the three re-anchored cases replaced their old
versions one for one.
**AND THE CI UNIT HALF MATCHES**: run **`35921456483` on `bee51307`** reads
**`# tests 7230 / # pass 7226 / # fail 0 / # skipped 4`** (`duration_ms
107,507`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all seven new or re-anchored cases found passing BY NAME (`ok
1735` in `edit-page-context`, `ok 1770`–`1772` and `1775` in the new cases,
`ok 1794`–`1795` in `edit-page-protect`) and zero `not ok` lines in the
downloaded log. **AND `site build` run `35921456542` on `bee51307`**
(21:17:04 → 21:42:28Z, **25m24s**, all twenty steps) read all twelve counts
green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
**382**, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all
passed`, census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
(`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
compiles a broken page on purpose, the second followed by the two SSR-stream
lines and then its own `ok`, `tsc`-format lines 9 / 2 / 7; `site-build.mjs`
**18m37s**. **The stamp chain ends at `bee51307`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED and every writer is
a stub that applies the ask to what it is shown, so this proves the route runs
the page operation once, keeps the order and the picture step's result, bills
once and says what shipped — never that a real model's first page attempt
applies the whole request, which is the premise the skip rests on.

### MERGED AND DEPLOYED: DUPLICATE EXECUTION CLOSED (2026-09-23, late)

Owner: *"The duplicate-execution correction is reviewed: all 81 focused cases
pass. Close the reproduced duplication defect, retaining the limit that these
tests supply model answers. Merge and deploy the reviewed correction,
preserving newer main work. Report the actual deployed SHA and image. No paid
replay."*

- **CLOSED, WITH THE LIMIT KEPT**: the route runs one requested page change
  once — neighbouring page lanes as one operation, and across another rung the
  later step only where the earlier did not succeed. Every model answer in the
  evidence is SUPPLIED, so no claim is made that a real model's first page
  attempt applies the whole request.
- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `90045638` →
  **`d7890bab`** at **22:22:15Z**, 4 commits, 10 files (+1,618 / −115): both
  page-once fixes, their tests and mutation specs, and the two documents.
  Asked before the push: zero runs in progress or queued, the image id
  predicted over both ends (the nineteenth cross-check, below), and the
  rollback verified in a throwaway worktree — reverting the range gives tree
  `fde516bb…`, **main's own**, so a rollback reuses `1aba925de4658f45`.
- **DEPLOY 2148 (`35927959426`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  job 22:22:20 → 22:25:19Z, **2m59s**; image step **2m08s** with **0 `CACHED`
  lines** (cold again, inside the warm band); Wrangler 23s. `DEPLOY_ID`
  **`d7890bab48828d6092399571d050eb02536973ac`** (masked in the log as
  `…9239957***d050eb…`); image **built `bb412dcada44c503`** (registry answered
  404, 185 inputs — the log prints `bb4***2dcada44c503`) and **rolled from
  `1aba925de4658f45`** (`- …:***aba925de4658f45` → `+ …:bb4***2dcada44c503`
  under `SUCCESS Modified application`, `Applied changes`); `Uploaded
  isibi-app`, `Current Version ID: 36990fe3-…`, `Deployed isibi-app triggers`.
  **`No updated asset files to upload`** — `public/` did not change — so there
  is **no served-file check**. Gates **401 / 401 / 401 / 404** at 22:26:15Z.
- **THE NINETEENTH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `1aba925de4658f45` (what deploy 2147 rolled to) and the
  tip `bb412dcada44c503`, both from 185 inputs, `builder/site-lanes.mjs` and
  `worker.js` the two of the push's ten files among them.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `d7890bab48828d6092399571d050eb02536973ac` and `expect_image`
  `bb412dcada44c503` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

### A PAGE VERB BELONGS TO ITS OWN STEP (2026-09-23, merged and deployed in 2149)

Owner, after reproducing it through the route: *"On the home page put the
opening hours above the welcome, and remove the gallery page." With shape +
pages/remove, no page writer runs. The gallery is removed, the homepage stays
unchanged, and the reply warns that the homepage cannot be removed. Scope
remove and move/rename instructions to their individual operation and target,
not shared request-wide flags. An ordinary layout step must not inherit another
step's destructive action.* **Reviewed and CLOSED by the owner (251 focused and
regression tests passing), merged and deployed in deploy 2149 — the next
section. No paid run; the supplied-answer limit is kept.**

**THE DEFECT, MEASURED THROUGH THE ROUTE ON HEAD `67c010fd`** (supplied
answers; four pages — `/`, `/prices`, `/gallery`, `/visit` — none linking to
another, so a wrong removal or move lands rather than being stopped by the
merge's own link check; the job path identical):

| message | page writers | what shipped | charged | the customer's screen |
|---|---|---|---|---|
| home layout + remove `/gallery` | **0** | the gallery removed, the home page unchanged | 0 | *"✅ Took /gallery off the site. Every publish is kept, so say the word if you want it back. ⚠️ I left / — that is the home page, and removing it would leave the site with no front door."* |
| `/prices` layout + remove `/gallery` | **0** | **`/prices` DELETED** as well as the gallery | 0 | *"✅ Updated the look."* |
| home layout + move `/gallery` → `/photos` | **0** | the gallery moved, the home page unchanged | 0 | *"✅ Updated /gallery. ⚠️ I couldn't move that page — the home page has no address to move."* |
| `/prices` layout + move `/gallery` → `/photos` | **0** | **`/prices` MOVED to `/photos`**; the gallery's own move refused | 0 | *"✅ Updated /prices. ⚠️ I couldn't move that page — there is already a page at /photos."* |
| the router's `remove` (picture door) + a `/prices` layout lane | **0** | **`/prices` DELETED** | 0 | *"✅ Took /prices off the site. Every publish is kept, so say the word if you want it back. ⚠️ I couldn't find a photograph on your site that I can change. …"* |

- **THE HOME PAGE'S OWN PROTECTION IS WHAT HID IT.** In the owner's
  reproduction the layout step's inherited removal was REFUSED (the home page
  cannot go), which is why the damage looked like a missing layout change.
  Aimed at `/prices`, nothing refused it: the page was deleted, and the screen
  said *"✅ Updated the look."* — **byte-identical to what the fixed code says
  when it works**, so from the screen the deletion was invisible.
- **"CHARGED 0" IS NOT A SAVING.** The removal and move branches are free and no
  writer ran, so the picker call went unbilled (our cost) — the customer paid
  nothing for a message that deleted or moved the wrong page and did not make
  the change they asked for.
- **TWO SOURCES OF ONE FLAG.** (1) The `pages` step WROTE the picker's verb into
  the message-wide `let`s while the steps were being built, so every page step
  read it. (2) The router's own `remove`, read off the body, opens the lane door
  for `picture` and `nav` — and a page lane the picker named beside the picture
  lane read that same flag (row five).

**THE FIX: A VERB RIDES ON THE STEP IT WAS GIVEN TO.** The `pages` step carries
`{remove, rename}` from the picker's verb and target; the router's own step
(the non-look branch, and the removal door's fall-through) carries the
router's; `runLayer(eLayer, ePage, pickedFields, eRemove, eRename)` takes the
STEP's verb under the two names every branch already reads — the precedent
`eLayer`/`ePage` set — so the router's are shadowed inside it and no rung can
read another step's. The router's two are `const` now. **The logo rung reads the
step's `eRemove` too** — equal to the body's on every path that reaches it (no
lane dispatches to `logo`), so that line is argued in the code and no case can
separate the two.

- **THE DUPLICATE-EXECUTION FIX CANNOT ABSORB A VERB STEP**, measured rather
  than assumed: `sentencePageStep` requires at least one field and every field a
  page lane — the `pages` step's one field is not a page lane
  (`laneLayer("pages")` is null) and the router's own step has no fields. So
  `mergePageSteps` never joins a verb step and `pageStepDone` never skips one.
  **`site-lanes.mjs` is untouched.**
- **UNCHANGED, AND SAID**: a picker that folds `pages` under `removes` without a
  `pageName` still targets the page the ROUTER named (`name: ePage || ""`) —
  the named-page section's recorded consequence — and the picker's own
  `pageName` still wins when it gives one.
- **THE QR PLACEMENT STEP WAS THE SAME CLASS**: a page step with an ask of its
  own, so `qr` beside `pages` would have run the placement down the removal or
  move branch on its page. It carries no verb now — **by construction, not
  driven by a case**.

**AFTER, SAME ROUTE, SAME ANSWERS, BOTH MONEY PATHS**: each layout case runs
**1** page writer, shown the stored target page; **1** compile carries the
layout change AND the verb's result; the unrelated pages are byte-identical in
the payload and the store; debits **`[3]`** (synchronous) / **reserve seq 1 = 3**
(job), nothing refunded; `layers ["page", "page"]`, no `partial`; `removed:
["gallery.tsx"]` or `renamedTo: "/photos"`. The picture door: `/prices` laid
out and KEPT, `partial [picture no-slots]`, *"✅ Updated /prices. ⚠️ I couldn't
find a photograph on your site that I can change. If you'd like one added, say
which page it should go on and where."*

- **⚠ THE COMBINED REPLY NAMED NEITHER CHANGE**: *"✅ Updated the look."* The
  merged reply lands on the browser's look branch, which read no `removed`, no
  `renamedTo` and no page, and `renamedTo` had no reader in the browser at all,
  so a standalone move said *"✅ Updated /gallery."* — the OLD address. Left
  exactly as it was by this fix and asserted, so changing it was a decision
  made on purpose: **it is the next section, *the reply names the page
  operations that shipped*.**

**EVIDENCE.** `test/edit-page-verb.test.mjs`, **17 cases**: layout + removal
and layout + move on the home page AND on `/prices`, each on both money paths
(8); the picture door (1); two layout lanes beside a removal — one page
operation, the removal its own step (1); and **7 controls** — the router's own
removal and move on both paths, the `pages` lane's removal and move alone, and
the `/prices` layout alone. Every case asserts the writer's calls and the file
it was shown, the compiler payload and the store page by page, the unrelated
pages byte-identical, the money on its path, and the customer's exact sentence
through `editBrowserReply`. **Red 10 of 17 against `67c010fd`** in a throwaway
worktree, each on its first gate (*no page writer ran*); **with that gate cut in
the throwaway copy every one of the ten still fails on the compiler payload**
(the home page unchanged, or `/prices` missing from the page set), so each layer
sees the defect alone. The 7 controls pass on both sides, and
`edit-page-once.test.mjs` — the duplicate-execution controls — is unchanged and
green.
**Four pre-existing guards re-anchored to what they assert**: `edit-parts` (the
call's POSITION between the ask being set and restored, anchored on the call
without its whole argument list), `removal-door` (the door's fall-through is
still the router's own layer and page, now carrying the router's verbs),
`site-ask` (`const eRemove`, read strictly off the body) and `edit-path` (a
comment quoting the deleted line).
**Focused mutation check `scripts/mutants/page-verb.json`: 7 mutants, 7 killed,
0 survived, 0 never applied, the comment-only control surviving**, against 13
files (`edit-page-verb`, `edit-page-once`, `edit-failure`, `edit-path`,
`removal-door`, `site-ask`, `edit-parts`, `site-delete`, `edit-lanes`,
`edit-page-target`, `edit-page-context`, `edit-page-protect`, `site-apply`):
the `pages` step losing its removal, losing its move, the loop forwarding the
ROUTER's verbs, any step's verb reaching every step (the defect restored), the
router's own step without its verbs, without its move, and `runLayer`'s
parameter renamed so the page rung reads the router's flag. `worker.js`
byte-identical to its scratchpad backup afterwards. **Two lines left out of the
sweep, and said**: the door step's verbs (inert today — the `picture` and `nav`
rungs read neither) and the logo rung's read (equivalent on every reachable
path).
**Suite 7,247 locally** (`# tests 7247 / # pass 7247 / # fail 0 / # skipped 0`,
`duration_ms 117,405`) — **+17 against 7,230**, exactly this file's cases; the
re-anchors added assertions, not cases.
**AND THE CI UNIT HALF MATCHES**: run **`35930143106` on `9ca86137`** reads
**`# tests 7247 / # pass 7243 / # fail 0 / # skipped 4`** (`duration_ms
110,793`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all seventeen cases found passing BY NAME (`ok 1823`–`1839`) and
zero `not ok` lines in the downloaded log. The docs-only `9dd117df` reads the
same four numbers on run `35930280497`, so the pair off CI says that commit
moved the suite by zero. **AND `site build` run `35930143439` on `9ca86137`**
(22:46:16 → 23:11:56Z, **25m40s**, all twenty steps) read all twelve counts
green out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
**382**, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
site-runtime 47, kit-render / kit-a11y / kit-effects / kit-paint `all passed`,
census 7 + 4 + 1 = **12**; the two known `##[error]` annotations
(`index.tsx(50,13) TS2322`, `menu.tsx(27,17) TS2339`) inside the case that
compiles a broken page on purpose, the second followed by the two SSR-stream
lines and then its own `ok`; `tsc`-format lines 9 / 2 / 7, **the same nine
lines as run `35921456542`'s** (counted over any `.tsx(l,c): error TS` line — a
reader limited to `src/routes/` answers 8 / 2 / 6, missing the kit's
`chart-bar-label.tsx` line); `site-build.mjs` **18m34s**. The documents-only
commits after it fire no site build. **The stamp chain ends at `9ca86137`.**
**⚠ WHAT IT DOES NOT CLAIM**: every model answer is SUPPLIED and the page writer
is a stub that applies the layout to the file it is shown, so this proves the
route scopes each verb to its own step and target — never that a real picker
names these lanes and this verb, nor that a real writer makes the layout change.

### MERGED AND DEPLOYED: THE PAGE-VERB CORRECTION (2026-09-23, late)

Owner: *"The page-verb correction is reviewed: 251 focused and regression tests
pass. Close the shared-flag defect, keeping the supplied-model-output
limitation explicit. Merge and deploy the reviewed correction, preserving newer
main changes. Report the actual deployed SHA and image. No paid replay."*

- **CLOSED, WITH THE LIMIT KEPT**: a remove or move verb rides on its own step
  and target, so a layout step beside it can no longer remove or move its own
  page, and the router's own verb reaches only the router's step. Every model
  answer in the evidence is SUPPLIED and the page writer is a stub, so no claim
  is made that a real picker names these lanes or a real writer makes the
  layout change.
- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `d7890bab` →
  **`d86aa232`** at **23:53:09Z**, 5 commits, 9 files (+1,006 / −57): the fix
  in `worker.js`, its 17-case test file and mutation spec, four re-anchored
  guards, and the two documents. Asked before the push: `HEAD..origin/main`
  empty, zero runs in progress or queued, the image id predicted over both ends
  (the twentieth cross-check, above), and the rollback verified in a throwaway
  worktree — reverting the range gives tree `79b0e0b7…`, **main's own**, so a
  rollback reuses `bb412dcada44c503`.
- **DEPLOY 2149 (`35935786369`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  job 23:53:17 → 23:56:11Z, **2m54s**; image step **2m14s** with **0 `CACHED`
  lines**; Wrangler 15s. `DEPLOY_ID`
  **`d86aa232687d4a0e56e9ce5d75c503dbb9e3fc38`** (unmasked in the log); image
  **built `d6d603e4a7921f14`** (registry answered 404, 185 inputs — the log
  prints `d6d603e4a792***f***4`) and **rolled from `bb412dcada44c503`**
  (`- …:bb4***2dcada44c503` → `+ …:d6d603e4a792***f***4` under `SUCCESS
  Modified application`, `Applied changes`); `Uploaded isibi-app`, `Current
  Version ID: 242ee8f5-…`, `Deployed isibi-app triggers`. **`No updated asset
  files to upload`** — `public/` did not change — so there is **no served-file
  check**. Gates **401 / 401 / 401 / 404** at 23:57:52Z.
- **THE TWENTIETH IMAGE-ID CROSS-CHECK, BOTH ENDS PREDICTED BEFORE THE PUSH**:
  `origin/main` answered `bb412dcada44c503` (what deploy 2148 rolled to) and the
  tip `d6d603e4a7921f14`, both from 185 inputs, `worker.js` the one of the
  push's nine files among them.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `d86aa232687d4a0e56e9ce5d75c503dbb9e3fc38` and `expect_image`
  `d6d603e4a7921f14` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

### THE REPLY NAMES THE PAGE OPERATIONS THAT SHIPPED (2026-09-24, merged and deployed in 2150)

Owner: *"Layout + removal must identify the edited page and the removed page.
Layout + move must identify the edited page and the move's old and new
addresses. A standalone move must report the move, not "Updated" at the old
address. Use successful operation results, not the request's wording, as
evidence. Preserve partial-failure warnings and do not describe a refused
removal or move as completed. … Keep this to operation reporting—not a
requirements redesign."* **Reviewed by the owner (263 focused and regression
tests, both CI checks green), merged and deployed in deploy 2150** — no paid run.

**MEASURED THROUGH THE ROUTE BEFORE THE CHANGE** (supplied answers, the
page-verb fixture): all four combined cases said *"✅ Updated the look."*; a
move on its own said *"✅ Updated /gallery."*; and a refused removal or move
beside a layout change was ALREADY right — *"✅ Updated /prices. ⚠️ I left / —
that is the home page…"* — because the one step that succeeded lands on the
page branch and the refusal rides `partial`. **The combined reply could not
have said more**: the merge's catch-all keeps the FIRST `page`, so *"lay out
/prices and move the gallery to /photos"* replied `page: "/prices"` beside
`renamedTo: "/photos"`, and the move's starting address was on no field at all.

**THE ROUTE CARRIES `pageOps`**: one entry per page step that SUCCEEDED, in the
order it ran, each `{page, removed, renamedTo}` read off that step's own reply —
`removed` the files the merge really took away, `renamedTo` the address
`renameRoute` really published. Built from `ranOk`, so a refused step cannot be
listed; it stays on `partial`, in its own words.

**THE BROWSER HAS ONE COMPOSER FOR IT, `pageOpsSaid`**, and both shapes go
through it: the page branch (a single page step's reply is read as its own
entry) and the look branch (a multi-step reply). `pageOpVerb` is the one
reading of which operation an entry was. The old removal branch's sentence is
byte-identical through the new composer.
- **THE LOOK BRANCH USES IT ONLY WHEN AN ENTRY REMOVED OR MOVED A PAGE**, so
  every other multi-step sentence — page + picture, css + layout — reads as it
  did. With nothing else to name, the page operations ARE the sentence; beside
  a look change they follow it. **⚠ The `lookNote` early return appended them
  too, and that was half a fix**: *"✅ Your site already looks like that —
  nothing to change."* had been the WHOLE reply over a removal that shipped,
  and appending the removal left it claiming the whole message had nothing to
  change beside a change that shipped. The owner caught it — next section.
- **ONE PAGE, ONE CLAUSE**: two successful steps on one page are named once.
  Reachable by reading, not driven: the QR placement step carries an ask of its
  own, so `samePageOperation` never joins or skips it beside a layout step on
  the same page.

**WHAT THE CUSTOMER SEES NOW** (exact, all asserted): *"✅ Updated /prices and
took /gallery off the site. Every publish is kept, so say the word if you want
it back."* · *"✅ Updated /prices and moved /gallery to /photos."* · *"✅ Moved
/gallery to /photos."* · a refused removal or move beside a layout change
unchanged (*"✅ Updated /prices. ⚠️ I couldn't move that page — there is already
a page at /visit."*) · a standalone refusal unchanged.

**THE DISCRIMINATOR BETWEEN RESULT AND REQUEST**: a move asked for as
*"/Photos/"* reaches the step as `"/photos/"` (the picker's reader lowercases)
and is published by `renameRoute` as `"/photos"`; the reply says `/photos`. A
reply composed from the request would say `/photos/`, and a mutant doing
exactly that is killed by that one case.

**⚠ FOUND ON THE WAY, NOT CHANGED**: a refused standalone move answers without
`unchanged: true` (a refused removal carries it), so its screen has no
whole-request note — *"⚠️ I couldn't move that page — there is already a page at
/visit."* and nothing after it. It never claims the move happened; recorded, not
fixed. And the old removal branch appended `problemNote` itself while the
wrapper appends it again — a double that could never fire, a removal's reply
carrying no `problems`, and the text branch has the same latent twin.

**EVIDENCE.** `test/edit-page-verb.test.mjs`, **17 → 29 cases**, every one
through the real route and the browser's own composer, asserting the stored
pages, the compiler payload, the money and the exact sentence: the four
combined cases and the joined-layout case now assert `pageOps` and the new
sentence; the standalone move (router, both paths; pages lane) asserts *"✅
Moved /gallery to /photos."*; **new**: a refused removal and a refused move
beside a layout change (both paths), a refused move and a refused home-page
removal on their own (both paths), the `/Photos/` discriminator, a stylesheet
change beside a removal, an unchanged look beside a removal (its expectation
corrected by the next section — it asserted the misleading sentence), and the
one-clause composer case. **Red 20 of 29 against unfixed `9a4d1787`** in a throwaway
worktree; **with the `pageOps` assertion cut, 16 of 29 fail on the sentence
alone** — the four partial-success cases then pass, their sentences having
been right already, so they fail on the unfixed code only on the missing
field. The 9 green on both are the controls (the standalone removals, the
layout alone, the picture door, the four standalone refusals).
**Two pre-existing guards went red and neither was appeased**: `site-apply`'s
landmark window (`const was = imageSources(…)` → `const merged = {`) grew by the
new block, and the block MOVED rather than the window widening — it reads only
`ranOk`, so it sits beside `flat` and `last`; `site-ask`'s *"the customer is
told the page went"* matched the old composer's spelling (`'Took ' + (gone`) and
now DRIVES the composer on the removal rung's reply shape.
**Focused mutation check `scripts/mutants/page-reply.json`: 16 mutants, 16
killed, 0 survived, 0 never applied, the comment-only control surviving**,
against the 24 files that can see the change (the edit-path and reply tests,
`site-ask`, `site-apply`, `free-identifiers`, `wiring`): four in the route (a
refused step listed, the move's address and the removal taken from the
REQUEST, the field off the reply), eleven in the composer (the old
removal-only branch, page operations composed without a verb, dropped as the
sentence / after the look / after `lookNote`, a move said as an update, either
verb unrecognised, the removal's "every publish is kept", the "and", the
one-clause rule) and one in the harness (the composer not cut out of
`chat.js`). All three swept files byte-identical to their pre-sweep hashes
afterwards. **Two mutants were left out and are inert by construction, said
here rather than swept**: the entry's `page` taken from the step (the page
rung's `wantRoute` IS the step's page, lowercased by both readers), and the
removal named by the step's page rather than the files (`sitePathOf` of the
removed file IS that page on every fixture). **Suite 7,259 locally** (`# tests
7259 / # pass 7259 / # fail 0 / # skipped 0`, `duration_ms 121,328`) — **+12
against 7,247**, exactly this file's new cases; the `site-ask` re-anchor
added an assertion, not a case.
**AND THE CI UNIT HALF MATCHES**: run **`35937632664` on `45ea3eec`** reads
**`# tests 7259 / # pass 7255 / # fail 0 / # skipped 4`** (`duration_ms
113,089`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all twenty-nine of this file's cases found passing BY NAME (`ok
1823`–`1851`), the re-anchored `site-ask` case as `ok 3868`, and zero `not ok`
lines in the full downloaded log (44,611 lines; the job-log tool returns only
its tail, so the run's log archive is what was read). **AND `site build` run
`35937632658` on `45ea3eec`** (00:16:06 → 00:40:09Z, **24m03s**, all twenty
steps) read all twelve counts green out of its per-step files: TAP
397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, kit-render /
kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1 = **12**; the
two known `##[error]` annotations (`index.tsx(50,13) TS2322`,
`menu.tsx(27,17) TS2339`) inside the case that compiles a broken page on
purpose, each directly above its own `ok` line this time; `tsc`-format lines
9 / 2 / 7, the same nine lines as run `35930143439`'s; `site-build.mjs`
**17m26s**. **The stamp chain ends at `45ea3eec`.** **The supplied-answer
limit holds**: this proves what the reply says about operations the route
performed, never that a real model makes the layout change.

### A LOOK THAT CHANGED NOTHING SPEAKS FOR THE STYLING ALONE (2026-09-24, merged and deployed in 2150)

Owner, after checking the reply correction (263 focused and regression tests,
both CI checks green): *"When the stylesheet already matches and the gallery is
successfully removed, the real browser composer says: "Your site already looks
like that — nothing to change. Took /gallery off the site." Scope the
no-change statement to the design operation that did nothing. … Do not
describe the whole request as having nothing to change when another operation
shipped. … Use the operation result to determine the scope."* **Reviewed by the
owner (71 focused tests, unit CI green; *"No further wording expansion is
needed"*), merged and deployed in deploy 2150** — no paid run.

**MEASURED ON HEAD `f4e28dc8`, THROUGH THE ROUTE AND THE BROWSER'S OWN
COMPOSER** (supplied answers, the stored sheet already the one asked for):
styling + removal *"✅ Your site already looks like that — nothing to change.
Took /gallery off the site. Every publish is kept…"*; styling + move *"… nothing
to change. Moved /gallery to /photos."*; and **styling + a layout change on
/prices *"✅ Your site already looks like that — nothing to change."* — the
WHOLE reply, over a layout change that shipped.** That third one is older than
the reply correction: the early return printed the look's note alone from the
day the note existed, and the correction only appended page operations that
removed or moved a page.

**THE SERVER SCOPES THE NOTE, FROM THE STEPS' OWN RESULTS.** `lookNote` is
composed server-side and the browser prints it verbatim, and the merge is where
every step's result is known — so the merge decides: a SUCCESSFUL step carrying
no note is an operation that shipped, and beside one the note is *"The
requested styling was already in place."*; otherwise it is the step's own
sentence. Read off `ranOk`, never off the request's lanes or verb. **A step
answering `ok` that wrote nothing would read as shipped** — none does in the
look door today (every `ok: true` the edit route answers is a write, checked by
listing them) — and that errs the safe way: the scoped sentence is true either
way, and only the whole-message one can be false.
- **AND THE BROWSER NAMES EVERY PAGE OPERATION THAT SHIPPED AFTER THE NOTE**,
  an ordinary edit included (`pageOpsSaid(ops)`, not `opsSaid`): with the look
  having changed nothing, nothing else in that branch can say what shipped. The
  non-note path is unchanged — there a verb-less page edit is still unnamed
  beside "Updated the look".
- **A TAB STILL RUNNING THE DEPLOYED `chat.js`** prints the note verbatim, so it
  gets the scoped sentence without the new composer: never the whole-message
  claim, only without the page operations after it.

**WHAT THE CUSTOMER SEES NOW** (exact, all asserted): *"✅ The requested styling
was already in place. Took /gallery off the site. Every publish is kept, so say
the word if you want it back."* · *"✅ The requested styling was already in
place. Moved /gallery to /photos."* · *"✅ The requested styling was already in
place. Updated /prices."* · and on its own, unchanged: *"✅ Your site already
looks like that — nothing to change."*

**⚠ A REFUSED OPERATION SHIPPED NOTHING, SO BESIDE ONE THE LOOK'S OWN SENTENCE
STANDS** — the owner's rule taken literally (*"when another operation
shipped"*), and recorded as a decision rather than left to be found: styling +
a refused removal of `/` reads *"✅ Your site already looks like that — nothing
to change. ⚠️ I left / — that is the home page, and removing it would leave the
site with no front door."*, the refused removal never described as done.
Scoping it there too is one condition, and the sweep's S-2 mutant is that
condition (`done.length > 1` for "a successful step without the note") — killed
by the two refused-operation controls, so the choice is pinned whichever way the
owner takes it.

**WHAT IT DOES NOT NAME**: a picture, menu or address change beside an
unchanged look gets the scoped sentence alone — the look branch names none of
those in any multi-step reply (the review's #9, next-task 3). The scoped
sentence is true of what it names and claims nothing about the rest.

**EVIDENCE.** `test/edit-page-verb.test.mjs`, **29 → 35 cases**: the
unchanged-styling case's expectation corrected and run on both money paths;
new: styling + move, styling + a layout change, and three controls — styling on
its own, and styling beside a refused removal and a refused move — each
asserting the stored pages, the compile count, `pageOps`, the note on the wire
and the exact screen. **Red 4 of 35 against unfixed `f4e28dc8`** in a throwaway
worktree — the removal (both paths), the move and the layout case, each first
on the note on the wire; **with those assertions cut, all four still fail on
the sentence alone**, the layout case reading *"nothing to change"* as its
whole reply. The controls pass on both sides. The edit-path set — 34 files —
**867 / 867**. **Focused mutation check `scripts/mutants/look-scope.json`: 6
mutants, 6 killed, 0 survived, 0 never applied, the comment-only control
surviving** — the note never scoped, scoped beside a refused step, scoped with
the look alone, scoped only by a verb; the browser naming only a verb after the
note, and nothing after it — against the same 34 files; both swept files
byte-identical to their pre-sweep hashes afterwards. **Suite 7,265 locally**
(`# tests 7265 / # pass 7265 / # fail 0 / # skipped 0`, `duration_ms 121,875`)
— **+6 against 7,259**, exactly this file's new cases.
**AND THE CI UNIT HALF MATCHES**: run **`35941990927` on `d4ae8af7`** reads
**`# tests 7265 / # pass 7261 / # fail 0 / # skipped 4`** (`duration_ms
121,097`) — the TOTAL is what matches, `pass` differing by exactly CI's four
skips — with all thirty-five of this file's cases found passing BY NAME (`ok
1823`–`1857`) in the full downloaded log archive, and **zero `not ok N` result
lines**. **⚠ A BARE `grep -c "not ok"` ANSWERS 4 ON THAT GREEN LOG**: two test
names contain the words *"is not ok"*, each printed twice (`# Subtest:` and its
own `ok` line). Count result lines anchored as `ok N -` / `not ok N -`, never
the phrase.
**AND `site build` run `35941990957` on `d4ae8af7`** (01:13:43 → 01:36:45Z,
**23m02s**, all twenty steps) read all twelve counts green out of its per-step
files: TAP 397/397/0/0, kit-typecheck 4, site-build **382**, contrast-cases 16,
theme-seam 11, theme-render 29, site-routing 14, site-runtime 47, kit-render /
kit-a11y / kit-effects / kit-paint `all passed`, census 7 + 4 + 1 = **12**; the
two known `##[error]` annotations (`index.tsx(50,13) TS2322`,
`menu.tsx(27,17) TS2339`) inside the case that compiles a broken page on
purpose; `site-build.mjs` **16m42s**. **The stamp chain ends at `d4ae8af7`.**

### MERGED AND DEPLOYED: THE REPORTING CHANGES (2026-09-24)

Owner: *"The scoped no-change correction passes review: 71 focused tests pass,
and unit CI is green. No further wording expansion is needed. Once the current
site build passes, merge and deploy the reviewed reporting changes, preserving
newer main work. Report the actual deployed SHA and image. No paid replay."*
Both corrections above — the reply naming the page operations that shipped, and
the look's no-change sentence scoped to the styling — plus their CI stamps.

- **A FAST-FORWARD, BECAUSE NOTHING NEWER WAS ON MAIN**: `main` `d86aa232` →
  **`4df02867`** at **01:39:42Z**, 5 commits, 9 files (+1,110 / −51), pushed
  only after `site build` run `35941990957` finished green. Asked before the
  push: `origin/main` unmoved, zero runs in progress or queued, the image id
  predicted over both ends (the twenty-first cross-check, above), and the
  rollback verified in a throwaway worktree — reverting the range gives tree
  `6b081e00…`, **main's own**, so a rollback reuses `d6d603e4a7921f14`.
- **DEPLOY 2150 (`35943904626`) — DEPLOYED, NOT RUNTIME-CONFIRMED.** Success,
  01:39:44 → 01:42:37Z, **2m53s**; image step **2m03s** with **0 `CACHED`
  lines**; Wrangler 18s. `DEPLOY_ID` **`4df028677ffef22cbe4399049fe6b4009bf2112f`**
  (the log prints `…4009bf2***2f`, the `***` a masked `11`); image **built
  `67a81b55332be3a9`** (registry answered 404, 185 inputs — the log prints
  `67a8***b55332be3a9`) and **rolled from `d6d603e4a7921f14`** (`- …:d6d603e4a792***f***4`
  → `+ …:67a8***b55332be3a9` under `SUCCESS Modified application`, `Applied
  changes`); `Uploaded isibi-app`, `Current Version ID: 1e7018c7-…`, `Deployed
  isibi-app triggers`.
- **THE SERVED-FILE CHECK, BOTH READINGS TAKEN**: `public/` changed, so
  Wrangler answered `+ /chat.js`, 1 file, 85 already uploaded. **Before** (taken
  at 01:27:27Z, before the push): 736,749 bytes, sha256 `bf745e7118484cad` —
  byte-identical to `d86aa232`'s — and **0** occurrences of `pageOpsSaid`.
  **After** (01:43:46Z): 740,600 bytes, sha256 `37983c53938d6581`, **4**
  occurrences — **byte-identical to `git show 4df02867:public/chat.js`**. The
  scoped sentence itself lives in `worker.js`, so the served file cannot show
  it; the Worker half rests on Wrangler's report until a signed-in read.
  Gates **401 / 401 / 401 / 404** at 01:43:46Z.
- **THE RUNTIME CONFIRMATION IS THE CANARY'S FREE PRESS** with `expect_deploy`
  `4df028677ffef22cbe4399049fe6b4009bf2112f` and `expect_image`
  `67a81b55332be3a9` — both routes that answer the sha and the image ask
  `authUser` first, and a session holds no token. **No paid replay** (owner).

