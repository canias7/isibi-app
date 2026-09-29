# 2026-09-29 — taking a photograph off takes its element off; keeping its space is asked for by name

Built on the branch `claude/help-needed-ehlwlj`, then **merged and deployed
the same day (deploy 2167, `cb981a4a`, below) on the owner's word; deployed,
not runtime-confirmed until the owner's free press; not run live**. Every
model answer below is supplied. Test 7 stays held until the runtime
confirmation and the owner's approval of the paid run.

## The owner's request

*"Implement the remove-versus-clear correction on the working branch, with
these safeguards:*
* *Use reliable TSX structure to identify the exact photo element. Do not
  infer safe deletion solely from neighboring characters.*
* *Do not automatically delete every parent that becomes empty. Preserve
  wrappers with layout, anchor, interaction, or other independent meaning.
  Remove a wrapper only when it is demonstrably just the removed photo's
  container.*
* *Preserve exact target identity when applying several changes. Matching
  again by page and alt text is insufficient when two photos share a
  description.*
* *If the model supplies contradictory actions such as remove and clear
  together, report that operation as invalid rather than silently choosing
  clear. Independently valid operations should still proceed.*
* *Carry an explicit removal result into the reply and recovery hint; do not
  infer it from photosRemoved > photos.*
* *For structures the targeted editor cannot safely remove, give an accurate
  refusal without silently clearing the image or removing a larger block.
  Record this as a remaining capability limit.*

*Keep swaps, reframing, and explicit keep-the-space requests working. Add
focused tests for these boundaries and the mixed two-page request, including
synchronous and queued execution. Show rendered before/after results for
removal and clearing. Update Test 7 to expect actual element removal, and mark
its old placeholder expectations as superseded. Complete the required focused
verification and CI, then push the branch for review. No merge, deployment,
paid run, or unrelated fixes."*

## What was wrong

Reproduced and rendered earlier the same day (the checklist's *Test 7 →
Held*): the lane picker is told that taking a photograph off means "the slot
that held it goes with it", but the picture tool's only removal was `clear`,
which empties the `src`. The customer who asked for the counter photo to come
off the Visit page got the kit's placeholder (grey bands, an image icon and
the photo's description as a caption) in the same 468×351 box.

## What changed (`builder/site-picture.mjs`, `worker.js`, `public/chat.js`)

- **Two answers in the picture tool.** `remove`: take the photograph off the
  page, the picture and its space both gone; what "take the photo off",
  "remove the picture" and "we don't want a photo there" mean, and never with
  another action. `clear` is narrowed to requests that ask to keep the space
  ("empty the frame", "leave a space for a new photo") and keeps its old
  result exactly.
- **The photograph is found in the page's syntax tree** (`photoRemoval`), with
  the TypeScript reader the tweak rung already uses (`tweakParser`), injected
  from `worker.js` as the picture step's `parser`. `imageSlots` now records
  each photo element's own offset (`from`), and the element taken off is the
  JSX node that starts at exactly that offset and has the slot's own tag. A
  page that does not parse cleanly, no parser, or no such node is `unchecked`:
  nothing is cut on a guess.
- **Only the photograph's own element, and a wrapper only when it is
  demonstrably just its container.** The element must be a self-closing
  `<SafeImage>` or `<img>` standing as a child of an element or fragment.
  A wrapper goes with it only while it is a plain `div`, `span`, `figure` or
  `picture` (`BARE_CONTAINERS`) with **no attributes at all**, whose only
  content is what is being removed (whitespace and comment-only braces aside)
  and which itself stands as a child of an element. A class, a style, an id, a
  key, a role, a handler, a spread, a link, a control, a landmark (`section`,
  `header`…) or any component keeps the wrapper, emptied. The element's lines
  go with it when it has them to itself.
- **Exact identity with several changes.** A removal is one more edit in the
  same pass as the page's other picture edits, at offsets read from the same
  source, applied back to front. Nothing is looked up again by page and
  description. Two photos on one page with one description are refused by name
  (`same`), since the description is the only handle the model has; one photo
  met twice by the scan (`media={<SafeImage …/>}` is read as an element and as
  a component's prop, with the same `src` span) is still one.
- **Contradictions are refused by name, and the rest proceeds.** `remove`
  beside `clear`, a new picture or a framing, and `clear` beside a new picture,
  are `conflict`: nothing is written for that photograph, and the answer's
  other entries still run. What one photograph is asked for is read over
  every entry naming it, so the same contradiction split over two entries is a
  conflict too. `clear` with a framing, and a new picture named both by file
  and by description, are not conflicts and read as before.
- **A removal that would take another chosen photograph with it** (one written
  inside its own attribute, `fallback={<SafeImage …/>}`) is a conflict for
  both, refused before anything is applied. Found by probing `applyPictures`'
  new overlap guard, which had made the whole step fail, independent changes
  on other pages included. The guard stays as a fail-closed backstop.
- **Refused, never cleared or widened**: a photograph held as a prop of a
  larger block (`Figure`, `MediaObject`, a hero), one written inside code (a
  condition, a map, an attribute value) or one with children is `part`, and
  the reply says so and offers the two things that would work: "Say “empty that
  photo” to keep its space, or ask for the block to be taken off."
- **The explicit result.** The picture step counts what it took off
  (`removed`), its step body carries `photosTakenOff`, and the merged reply
  sums it over the steps that ran, only when the publication carrying them went
  out. The browser's undo hint reads that field alone: "If that was not what
  you wanted, roll back to the previous build in Cloud → Versions." Once the
  space is gone, "put the photo back" has no slot to fill. A photograph gone any
  other way (`photosRemoved` with no `photosTakenOff`) keeps "say “put the photo
  back”", whatever `photos` says.
- **The reply names it**: "✅ Took “…” off the page." Each refusal has its own
  sentence saying what was left: `same`, `conflict`, `part`, `unchecked`.

**Unchanged**: the router, the lane picker and its lane texts (the `images`
lane's promise is now what happens), the photo guard, the accounting
(`photosRemoved` counts a removal; `photos`, the new empty frames, stays 0), the
cost (the same one picture-model call), swaps, made pictures, reframes and
keep-the-space.

## Where it departs from the plan the owner reviewed

- An answer with both `remove` and `clear` was to be read as `clear`; it is a
  `conflict` (the owner's fourth safeguard).
- Every parent left empty was to go, upwards; only a bare container goes (the
  second). On the stored test pages below, this removes no wrapper at all.
- Removals were to run first and the page's other choices be found again by
  page and alt; everything is one pass by offset (the third).
- The undo hint was to read `photosRemoved` above `photos`; it reads
  `photosTakenOff` (the fifth).
- Found while building: the double-read photo (`same` must not fire on it),
  the nested conflict, and the split contradiction, each above.

## Where the parser is, in production

`typescript` is a devDependency: the container resolves it from the template's
install, and the Worker bundle (`npm ci --omit=dev`) has none
(`docs/history/2026-09-21-22-runs-9-to-23.md`). Every edit is queued
(`EDIT_ASYNC_EVERYONE` defaults to `on` in `deploy.yml`) and every queued job
runs in the container (`JOB_RUNNER_EVERYONE` is on,
`docs/containers-and-jobs.md`), so a removal is checked there. A job that runs
inline in the Worker (the runner off, or no binding) refuses every removal as
`unchecked`, with its own sentence, and changes nothing.

## Tests

Supplied model answers throughout; the route, the parser and the browser's
composer are real.
- **Unit** (`test/site-picture.test.mjs`): the tool's two answers; `remove`
  alone and beside each other action; the split contradiction; the shared
  description; own lines; an inline photograph and an `<img>`; bare containers
  up the tree; every kind of meaningful wrapper kept (class, style, id,
  `data-`, role, handler, spread, key, `a`, `button`, `section`, `li`, `p`,
  `AspectRatio`, `Parallax`, a `figure` with a class); a component's root
  kept; each `part` shape; each `unchecked` shape; a stale slot whose offset
  lands on another element; a comment-only brace versus a real expression;
  exact identity (a removal and a swap on one page, two photos sharing an
  address, descriptions that begin alike); the overlap backstop; the nested
  conflict beside independent changes on two pages; each refusal's sentence;
  and a page with no removal never loading the reader.
- **Through the real edit route** (`test/edit-removal-door.test.mjs`), each
  synchronously and through the real queue consumer: take it off (the Visit
  page exactly the fixture less the counter's element, the other four pages
  byte-identical, one compile, `photosTakenOff: 1`, `photosRemoved: 1`,
  `photos: 0`), through the removal door and again with the router's `remove`
  flag absent, so the picture rung is called directly; keep the space (exactly the old output and screen); a
  contradiction refused beside a reframe that ships; a photograph inside code
  refused with nothing compiled; and **Test 7's mixed two-page message** on the
  look door and on the removal door (the writer handed only the home page and
  its words, the picture step run once, the Visit page and the home page
  exactly the expected ones, the other three pages byte-identical, one
  compile, `photosTakenOff: 1`). And the undo hint in both directions where the
  two counts disagree with the explicit one.
- **Updated**, each a supplied `clear` for a "take … off" request, now
  `remove` with its new outcome: the bench (`edit-page-once`), the window five
  times (`edit-page-protect`) and once (`edit-page-photos`), the boule in the
  removal-door cases, and the old "clearing beats a description" case, now a
  conflict.

## Verification (measured)

- **Red check** on `17d1903c` (the unfixed code) with the new test files, in a
  throwaway worktree: 102 tests, **33 fail** (every removal, conflict,
  refusal, mixed-message and undo-hint case, sync and queued, on both ways in;
  the unit file cannot load without `photoRemoval`), and the controls pass:
  keep the space, sync and queued, and the fixture check.
- **Mutation sweep** (`scripts/mutate.mjs`, five test files) over the new code
  in all three files: **44 mutants, 41 killed, 3 survived**, 0 never applied,
  and the 3 comment-only controls survived. The survivors were three questions
  nothing asked: the node at the slot's offset having the photo's tag, a
  comment-only brace inside a bare wrapper, and the undo hint where the counts
  disagree with the explicit result. A test for each was added, and the three
  re-swept: **3 killed**, controls surviving. The tree was restored byte for
  byte after each sweep (checksums compared).
- **The related suites** (twelve files): 560 pass.
- **The full unit suite, locally: 8,277 tests, 8,277 pass, 0 fail, 0
  skipped.** 36 more than main's 8,241, measured file by file at `17d1903c`
  and now (`site-picture` 66 → 86, `edit-removal-door` 45 → 61). No local skips
  this time: the two `sheet-rtl` browser cases run once the template's
  dependencies are installed, as they were for the renders. The first run had
  **one failure, a guard pinned to spelling**: `test/add-second-one.test.mjs`
  matched `import { runTweak, keptProse } from "./builder/site-tweak.mjs";`
  byte for byte, and that import now also brings `tweakParser`. Re-anchored on
  its property (`keptProse` comes from the tweak rung's own module, the form
  its neighbouring line already uses), and shown to still fail when the import
  points anywhere else.
- **CI on the pushed commit, `4ee123d2`**: `unit tests` (run 36539848541)
  8277 / 8273 / 0 / 4, the same total as locally, with the four CI skips main
  has; `site build` (run 36539848416) green in 25m49s, all twelve counts read
  from each step's log and identical to main's (TAP 397, kit-typecheck 4,
  site-build 404, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47, and kit-render, kit-a11y, kit-effects and
  kit-paint all passed), with only the two known `##[error]` annotations from
  the case that compiles a broken page on purpose.
- **The container image**, predicted over both ends with the deploy's own
  functions: `main` `6fbaccad82fe879d` (deploy 2166's, reproduced) →
  `65ce683607928f0e`, 188 inputs and 158 distinct paths on both; only
  `builder/site-picture.mjs` and `worker.js` moved. `public/chat.js` is served
  by the Worker and is not an input. A merge would build and roll the image,
  and the served `chat.js` would owe its byte comparison.
- **The stored test pages** (`test/fixtures`, 341 files), classified by the
  implemented code: 210 photographs the picture step can address; **190 come
  off**, none taking a wrapper; **20 refused `part`** (16 `Figure` props, 2
  `MediaObject` props, 2 `media={<SafeImage …/>}` values); 0 `unchecked`.
  21 of the 190 leave an emptied wrapper, kept: 9 `<section>` (5 with no
  attributes, 4 with a class), 7 `<div>` with a class, 5 `<Parallax>`.
- **Rendered with the real build service**, from the route's own output on the
  bakery's stored pages (sent to the owner): before, identical to the live
  `/visit` (0 of 1280×1431 pixels differ); remove, the counter's element gone,
  nothing drawn in its place, the location card moved up and the page 243 px
  shorter (1431 → 1188); clear, the placeholder in the kept 468×351 frame,
  exactly the old result. The reply: the removal's hint now points at Cloud →
  Versions; keep-the-space unchanged.

## The remaining capability limits (backlog)

- **A photograph the picture step cannot take off on its own** is refused, not
  cleared or widened: one held as a prop of a larger block, written inside
  code, or with children (20 of 210 on the stored test pages). The sentence
  offers to empty it or to take the block off; nothing yet takes a block off
  for the customer in one step.
- **An emptied wrapper with a meaning of its own is kept**: 21 of 190 on the
  stored pages. One with padding, a background or a class that gives it size
  can leave visible empty space where the photograph was.
- **Two photographs on one page with one description** cannot be told apart.
- **With no parser** (a job run inline in the Worker) every removal is
  refused as `unchecked`.
- **Not shown live**: no real picture model has been asked to choose between
  `remove` and `clear`.

## Test 7

It now expects the element removed: `visit.tsx` is the fixture with the
counter's six lines taken out (3,801 characters, sha256
`263dd01eaaa4345c543038d8df75ab065d612a5ecd965cb1c8d1c8672958f5c6`), `/visit`
draws no photograph and no placeholder where it was, and the screen reads "✅
Updated the look. One photograph is no longer on the site. If that was not what
you wanted, roll back to the previous build in Cloud → Versions." The old
placeholder expectations (3,989 characters, sha256 `46959b0d…`, the slot
drawing the placeholder, the "There is a space for a photo" sentence) are
marked superseded in the checklist. Test 7 stays held until the correction is
merged, deployed and runtime-confirmed; it is not run.

## Merged and deployed: deploy 2167 (2026-09-29)

Owner: *"Proceed with merging cb981a4ad to main and deploying the
photo-removal correction, subject to the existing pre-merge checks. Verify
nothing is in flight, confirm the candidate's CI, recheck the image prediction
against current main, and verify rollback in a throwaway worktree. The
recorded expected image is 65ce683607928f0e; investigate any difference before
merging. After deployment, verify the actual image built and compare served
chat.js against the merged file. Keep "deployed" separate from
"runtime-confirmed.""*

- **Pre-merge**: `main` still `a64729ad`, the candidate `cb981a4a` 12 commits
  ahead and none behind (a fast-forward); nothing in flight (no GitHub run in
  progress, queued or waiting; `edit_jobs` 173 `done`, 154 `failed`, 2 `lost`,
  none queued or running, the ten `failed` since deploy 2166 being the
  canary's own free probe pairs at cost 0); CI green on the candidate (`unit
  tests` 36542727770 on `cb981a4a`, 8277 / 8273 / 0 / 4; `site build`
  36539848416 on `4ee123d2`, whose product tree `cb981a4a` shares, the next
  commit only documenting); the image predicted again against current `main`:
  `6fbaccad82fe879d` → `65ce683607928f0e`, **exactly the recorded
  expectation**; and the rollback verified in a throwaway worktree: reverting
  `a64729ad..cb981a4a` gives `main`'s own tree, `c5862644…`. The served
  `chat.js` read before the merge (13:59:09Z) was `a64729ad`'s own, 787,454
  bytes, `50909c0b…`, with no `photosTakenOff`.
- **The merge**: `a64729ad` → `cb981a4a` at 13:59:46Z.
- **The deploy** (run 36579291309, deploy 2167): `built
  isibi-app-sitebuildcontainer:65ce683607928f0e (registry answered 404; 188
  inputs)`, `6fbaccad82fe879d` → `65ce683607928f0e` under `SUCCESS Modified
  application`, 0 `CACHED` lines, image step 2m21s, Wrangler 23s, job 3m18s;
  `+ /chat.js`, one file uploaded (85 already there). The gate took over from
  `a64729ad` and the drain found no live leases.
- **Served**: `/chat.js` at 14:05:21Z is byte-identical to
  `cb981a4a:public/chat.js` (788,171 bytes, `82f36de3…`; `photosTakenOff` 0 →
  4), and `/edit-poll.js` is unchanged. Gates 401 / 401 / 401 / 404. The
  bakery still answers at `8btpep` on all five pages, with its redirect.
- **Deployed, not runtime-confirmed.** The owner's free press (the edit
  canary with `no`, the deploy sha and the image id) is the reading that asks
  the live Worker and a cold container, after the image's roll settles (from
  14:25 UTC).
