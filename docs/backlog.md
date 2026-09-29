# Backlog: open items

> **Moved from `CLAUDE.md` on 2026-09-28, word for word**, in its sixth prune
> (the file as it stood: `git show 86eb5703:CLAUDE.md`). These are the open
> items as CLAUDE.md held them. The one-line index
> CLAUDE.md kept moved here in the second pass (`git show 28bdc97f:CLAUDE.md`)
> and is the first section below.
>
> **Add a new open item here, with a one-line title in the index below. When
> an item closes, record the closure where the work is recorded and take it out
> of both.** The older `docs/backlog-100-next.md`, `backlog-100-more.md`
> and `backlog-1000.md` are the July–August lists and are not kept current.
>
> In the text below, "this file" means CLAUDE.md, and "above" or "below" point
> at CLAUDE.md's other sections as they stood then; most of them now live in the
> docs listed in CLAUDE.md's map.

## The one-line index (CLAUDE.md's backlog list, as it stood)

The open items in full are `docs/backlog.md`. **Add a new one there and a line
here; take a closed one out of both.**

- A half of a message the router puts off (`alsoAsked`) is still attempted,
  on the home page, and the reply contradicts itself (run 52). **Fixed and
  deployed 2026-09-29 (deploy 2166); run 57 made both changes live, with
  nothing put off (Test 6, closed by the owner). The held-back path itself is
  shown only with supplied answers.**
- Five stylesheet rules match nothing the app serves, and the reachability
  guard counts them live only through a router sentence's line break.
- The header's button carries no `data-slot="button"`, so a rule against the
  kit's button hook misses it.
- The render check judges each selector of a list on its own, so a common
  heading rule can force a correction round.
- Redirects dropped between 2026-08-17 and deploy 2165 are not rebuilt.
- A page removal does not see a QR code that points at the page.
- The branded not-found page is thrown away on every Start site.
- The rules reply shows literal asterisks around the table name.
- Closing a table leaves the site inviting it, and the refusal is generic
  (`lido-axes-b`; a separate UX gap).
- The logo reply says "on every page".
- The thread's message bubble does not show an attached picture.
- The canary's job reader says `exempt` means a founder account.
- A literal heading names its section whether or not it renders, and names its
  whole section wherever it stands.
- `fretwork-1`'s stored language is Welsh over English copy (parked with
  translation).
- `updated_at` is never bumped; the `sync` flag has no reader.
- Four sites are still `incomplete` (repair: `backend repair` with
  `--apply-reference`, then `--verify`).
- The translator can read page code as text and write its answer back into the
  code (parked).
- A job cannot heal a blank backend reference (its gateway admits no PATCH) —
  read, not driven.
- The band and component prompts choose their digest with `siteHasTables`
  (latent).
- An add-on can design a table nothing can ever fill (reported, not refused).
- A working `video-embed` is invisible to the `data-slot` census.
- Model-written functions on older sites are never re-pinned.
- A refused photograph cannot name itself to anybody who can act on it.
- Salvage cannot fire on a new build; the QR rule is stricter than the rest of
  the design step (both the owner's call).
- The availability calendar's legend (`fretwork-1`) and the price-unit mismatch
  (`ashgrove-1`), both live.
- Raw hex colours are reported on every build and never enforced; in-page links
  that go nowhere.
- Two client POSTs go to routes the Worker does not have (`/api/site/scan`,
  `/api/site/preview`).
- 3D scenes ignore the theme colours; strings outside the page source are never
  translated.
- `env.EMAIL`'s 200-a-day quota is shared by login codes and every site's
  notifications.
- Static voice previews; real background removal (blocked on a fal top-up); the
  app's mobile layout (deliberately not being done).

---

## Backlog

- **A HALF OF A MESSAGE THE ROUTER PUTS OFF IS STILL ATTEMPTED (found
  2026-09-28 by Test 6's paid run, run 52; not changed).** The router answered
  `look` with the Visit page's band move in `alsoAsked` and named no page: one
  change per turn. The browser posts the whole message to the edit job (the
  canary does the same), so the look picker picked `shape` for the put-off
  half too, and that step ran on the home page, because the only page named
  belonged to the put-off half. The home page's writer found nothing to change
  (`page/no-change`), so nothing wrong was published or charged. But the reply
  says both "⚠️ I read the / page and couldn't find a change to make for that…"
  and "I only did one thing this time. Say “…” and I’ll do that next." Two
  questions meet here, and both are the owner's: whether the job should do
  only what the routing decided, and whether the router should put a band move
  on a named page off at all, when the look rung can do both in one turn.
  **Fixed 2026-09-29 (owner: "Fix the general routing/execution mismatch")
  and corrected after the owner's review; merged and deployed in deploy 2166,
  and exercised live by run 57, which made both changes; Test 6 is closed by
  the owner for what runs 57 and 58 showed.** The router puts
  off only what its answer cannot do this turn; a part it puts off is posted
  back by the browser and taken out of the message before anything runs
  (`heldBack`), and the reply's tail is composed from what the route really
  held back (`deferred`); the picker names each change's page and words
  (`scopes`), so each runs on its own page with its own words. The
  withholding is proven with supplied model answers only; run 57 measured a
  real router and picker on the ordinary path (both changes in one turn, the
  move scoped to `/visit`). The record is `docs/history/2026-09-29-op-scope.md`.
- **FIVE STYLESHEET RULES MATCH NOTHING THE APP SERVES (found 2026-09-29; not
  changed).** `.model-menu.drop-up.dir-menu`, `.nav-dd-menu`,
  `.nav-dd-menu.open`, `.img-src-menu` and `.img-src-menu .check` in
  `public/styles.css`: no served file names `dir-menu`, `nav-dd-menu` or
  `img-src-menu`, and none builds them. `test/css-reachable.test.mjs` counts
  them live only because a router sentence in `builder/site-ask.mjs` has a
  string starting "menu edit" right after a `+`, which its reader takes for a
  class suffix. Re-wrapping that unchanged sentence made the guard report all
  five, and its planted case, which assumes a stylesheet with no dead rule,
  failed with them. The original line break was put back rather than the rules
  deleted, because the served stylesheet is outside that fix. Whether they go
  is the owner's; so is whether the guard should read router prose as code.
- **THE HEADER'S BUTTON HAS NO `data-slot="button"` (found 2026-09-28 preparing
  Test 6; not changed).** `SiteHeader` renders its action as `<Button asChild>`
  around `SiteLink`, and `SiteLink` passes on only `href`, `className` and
  children, so the marker `Button` stamps is dropped. Read in the served HTML:
  on every fold-lane-bakery page the header's "Order a loaf" is an `<a>` with
  the button classes and no marker, while the CTA band's button carries it. So a
  stylesheet rule written against the kit's documented button hook recolours
  every button but the header's.
- **THE RENDER CHECK JUDGES EACH SELECTOR OF A LIST ON ITS OWN (found
  2026-09-28 preparing Test 6; read in the code, not driven; not changed).**
  `changedSelectors` splits `h1, h2, h3, h4, h5, h6` into six selectors, and a
  selector counts as dead when no rendered page has a match. The render check
  answers the site's data with empty lists, so on a site with only `h1` and `h2`
  (the bakery) a common heading rule would have four dead selectors and force a
  correction round. It sits in the stylesheet work the owner closed.
- **REDIRECTS DROPPED BETWEEN 2026-08-17 AND DEPLOY 2165 ARE NOT RECONSTRUCTED
  (recorded 2026-09-28, the owner: *"This patch preserves saved mappings; it
  does not reconstruct missing history."*).** From 53147339 until deploy 2165
  (`f5e941f4`), every publish wrote a redirect map holding only its own move
  pair, so a site that renamed or removed a page and then published again lost
  that redirect, and no removed page got one. The fix carries what a sidecar
  holds from now on; it rebuilds nothing. How many sites lost a redirect is
  UNMEASURED. Part of the history is readable: each version kept under
  `builds/<slug>/<version>/state/` carries the map it served, but a site keeps
  ten versions (`MAX_VERSIONS`), and publishes before 2026-09-05 used the
  legacy layout. Finding or restoring any of it is a separate decision.
  fold-lane-bakery's `/the-starter` → `/starter` is back only because run 50
  restored a version whose own map had it.
- **A PAGE REMOVAL DOES NOT SEE A QR CODE POINTING AT THE PAGE (found
  2026-09-28, run 49; not changed).** fold-lane-bakery's `/visit` still shows
  `qr-gallery.svg`, which encodes its `/gallery` address, after `/gallery` was
  removed. The link rule reads page source only. The owner's call: refuse the
  removal while a QR names the route, or re-point the code, or accept it.
- **THE BRANDED NOT-FOUND PAGE IS THROWN AWAY ON EVERY START SITE (found
  2026-09-28 tracing run 49; not changed).** For an address a site does not
  have, the script answers its branded not-found document with a 404; when
  `siteRedirectFor` finds nothing, the dispatcher does not return it but falls
  through to the static path, which on a Start site has no `index.html`, and
  answers the bare nine bytes `Not found`. The comment above says the script's
  answer stands; `site-worker-serve`'s test of it checks only the status. A
  small serve-side change (return the script's absolutized 404 when no
  redirect is found) is the owner's call.

- **THE RULES REPLY SHOWS LITERAL ASTERISKS (run 44, recorded; not changed).**
  `rulesReply` (`builder/site-rules.mjs`) writes each table name as
  `**<table>**`, and the chat shows a reply as plain text, so the screen read
  "✅ **bookings** — changed whether it's open." with the asterisks visible
  (the run's own screenshot). Kept with the model-written replies work, beside
  the generic "changed whether it's open".
- **A SEPARATE UX GAP: CLOSING A TABLE LEAVES THE SITE INVITING IT, AND THE
  REFUSAL IS GENERIC (run 44; recorded by the owner's instruction as its own
  item when the rules acceptance closed, 2026-09-27: *"don't expand this
  milestone to fix it"*; not changed).** Two halves:
  - **the invitation stays**: the rules rung changes the database and
    publishes nothing, so after "stop taking bookings on the website for now"
    `lido-axes-b` still shows "Book a table" in its header and hero, and the
    `/book` form;
  - **the refusal is generic**: a visitor who fills the form in is told
    "That isn't available.", not that the café is fully booked.

  The database half of the request is done and the page half is not. Whether
  such a message should also change the pages, and what the refusal should
  say, is the owner's call. **`lido-axes-b`'s bookings stay closed** meanwhile.
- **THE LOGO REPLY SAYS "ON EVERY PAGE" (run 39, recorded separately when the
  owner closed Test 4a, 2026-09-27; not changed).** The logo rung answers
  "✅ That's your logo in the header now, on every page.", and fold-lane-bakery's
  `/starter` is a salvage stub with no header, so the logo shows on four of its
  five pages. Wording only; the upload itself was byte for byte.
- **THE THREAD'S MESSAGE BUBBLE DOES NOT SHOW AN ATTACHED PICTURE (run 39,
  recorded separately; not changed).** The words show and the picture does not,
  because nothing stores an attachment on a thread message. The picture was
  sent and used: it became the logo.
- **THE CANARY'S JOB READER SAYS `exempt` MEANS "A FOUNDER ACCOUNT" (run 39,
  recorded separately; not changed).** `billingMeans` in
  `scripts/canary-read-job.mjs` dates from when only a founder was exempt.
  Since `ed1e3b93` a rung that makes no model call is exempt too, which is what
  run 39's logo and move jobs were. Harness wording, not the product.
- **THE TEXT GUARD CANNOT NAME A SECTION HEADED BY A KIT COMPONENT'S PROP
  (FIXED, MERGED AND DEPLOYED in deploy 2162, `ab74d0d9`: *a section headed by
  the kit*).**
  - **What happens.** `proseInventory` names a section only by literal
    `<h1>`–`<h6>` text or a `<section>`'s id or aria-label. A section headed by
    `<SectionHeader title="…">` therefore cannot be the target of "Remove the
    ‘…’ section", although the visitor sees that title as an `<h2>`. A correct
    removal is refused with `unconfirmed-target`, and the sentence asks for the
    heading the customer already gave.
  - **Reach.** 59% of the corpus's prose-bearing sections (329 of 555).
  - **Impact.** Fail-closed: no content lost, the routing charge spent.
  - **Status.** Fixed, closed by the owner after review, and merged and
    deployed in deploy 2162 (`ab74d0d9`, image `369d7b1e5bae25b0`); the rule and
    its limits are in *a section headed by the kit*. The owner's review of
    `2f2fed58` found that a kit heading the page may not render still named its
    section, closed at `5ec82214`. **It answered live on Test 4a's Part A** (run
    37, 2026-09-26): the correct removal published, and nothing else changed.
- **A LITERAL HEADING NAMES ITS SECTION WHETHER OR NOT IT RENDERS (found
  2026-09-26 in the kit-heading review, not changed).** The kit heading now
  must render whenever its section does; the literal reader has no such check.
  Measured: for 'Remove the ‘Today’s bake’ section from the home page.',
  `{false && <h2>Today’s bake</h2>}`, `<div hidden><h2>…</h2></div>` and
  `<Opaque><h2>…</h2></Opaque>` each name the section, and removing its visible
  paragraph is accepted. 4 of the corpus's 278 literal headings with words
  inside sections sit behind a condition. The owner bounded the correction to
  the kit recognition; aligning the literal reader is separate work.
- **A LITERAL HEADING NAMES ITS WHOLE SECTION, WHEREVER IT STANDS (found
  2026-09-26 while fixing the kit heading, not changed).** Measured:
  'Remove the ‘Sourdough’ section.' naming a card's literal `<h3>` inside a
  "Menu" section authorizes losing the whole Menu section's prose, the Rye card
  included (`{ok: true}` on the whole removal; losing another section is still
  refused). The kit rule is deliberately narrower (h1/h2 only, the heading that
  opens the section). Aligning the literal reader is separate work.
- **fretwork-1's stored language is Welsh (`lang="cy"`) over English copy**, so
  its switcher labels the home page "Cymraeg". Pre-existing, noticed 2026-09-25,
  parked with translation.
- **`updated_at` IS NEVER BUMPED (open).** `site-schema.mjs:1121` creates it as
  a column DEFAULT whose own comment says "bumped on every UPDATE", and a
  Postgres default applies only when the column is OMITTED from an INSERT. There
  is no trigger and no statement anywhere that touches it on an update. **The
  live consumer is a GENERATED PAGE**: the kit's `Row` type declares
  `updated_at?: string` precisely because models wrote
  `deal.updated_at ?? deal.created_at` in two consecutive evals. So a site
  showing "last updated" shows the CREATION time for ever. **An earlier write-up
  justified this by `/changes?sync=`, which occurs exactly once in the tree and
  is inside a CODE COMMENT** — *a comment describing a consumer is not evidence
  the consumer exists*, and one grep settles it.
- **THE `sync` FLAG HAS NO READER AT ALL (open).** It creates `_deletes` and a
  tombstone trigger per table — real DDL emitted on every site that declares it
  — and `_deletes` is on `INTERNAL_TABLES`, denied to the browser, with no route
  serving it. Every byte of that machinery is unreachable from outside Postgres.
  Decide per the standing rule: build the reader, or delete the flag and its DDL.
- **FOUR SITES ARE STILL `incomplete`** — `ashgrove-1`, `fretwork-1`,
  `northgroup-5`, `washhouse-1`. Fixed in code (no new site can enter the state)
  and the repair is two presses each: `backend repair --apply-reference` then
  `--verify`. `repairbench-1` is repaired and verified. **The rules rung, the
  addon and (since 2026-09-22, deploy 2144) the page rung resolve these sites
  themselves**, so the blank column no longer costs an edit its rules; the
  repair is still the clean state. **The full revise did not**: it read
  `ownerConn` off `siteBackendRowFresh` (`conn: null` here), so a revise that
  declares no table rewrote every page of these four sites under the
  no-database rules. **Fixed, merged and deployed in deploy 2160** (`80ce60f4` +
  `8f66dfb9`, the milestone section): a separate read-only `revConn` for the
  writer's spec, with `needsDb` and so the heal untouched.
- **THE TRANSLATOR CAN SEND PAGE CODE TO THE MODEL AND WRITE THE ANSWER BACK
  INTO THE CODE (open, found live on run 26; PARKED by the owner 2026-09-23).** `extractText`
  (`builder/site-text.mjs`) reads a `>` in page-level code as the end of a JSX
  tag, so `x >= 0 ? a : null; return (` became a "string" for
  `collectStrings`, was translated for each extra language, and was applied by
  `translatePages` into `/fr` and `/es`. The answer happened to be identical, so
  run 26's compiled code is intact in all three languages; a different answer
  would change the translated pages' logic, silently, on any edit that adds a
  `>` comparison outside JSX. Measure `extractText` over the corpus for code
  spans before changing it — it is also the reader `sameProse` stands on.
- **A JOB CANNOT HEAL A BLANK REFERENCE, BY ITS OWN GATEWAY'S RULE (read, not
  driven, recorded 2026-09-22).** `healSiteBackendDb` — called by the rules
  rung, the addon and `ensureSiteBackend` — is a `PATCH` on `site_backends`.
  Inside the container every service-key call goes through `gatewayFetch`, and
  `SB_TABLES` in `builder/job-gateway.mjs` lists no `PATCH` for any table. So
  from a job the heal is refused, and `healSiteBackendDb`'s never-throw contract
  turns that into a quiet `{ok: false, healed: false, status}`. **If that
  reading holds, only the `backend repair` workflow can heal these sites** — which
  matches all four still being blank. Settle it with one route test through the
  gateway before building on it.
- **THE BAND AND COMPONENT PROMPTS ASK A DIFFERENT QUESTION FROM THEIR OWN
  RULES (latent, recorded 2026-09-22).** `bandPrompt` and `partPrompt` choose
  the digest with `siteHasTables`, while the system block beside them comes from
  `pageRulesFor` → `siteHasBackend` — the 2026-09-14 correction `pagesPrompt`
  got and these two did not. A site with a function and no table would be told
  *"There is none"* under rules that say to call the functions the digest lists.
  **Unreachable today**: the split runs only on a first build (`bands:revise`),
  and a first build's design tool carries no `backend`, so its spec has no
  function. It becomes live the day either of those moves.
- **AN ADDON DESIGNS A TABLE THAT NOTHING CAN EVER FILL (reported, not
  refused).** `repairs` was declared `read:"none", write:"none"` — the `admin`
  pair — so no client grant is emitted **and `seedSiteRows` skips it**, that
  function seeding the `display` pair alone. **The SYMPTOM is gone** (the count
  function was moved onto `bookings` and `/status` reads 3) **and the DEFECT is
  not**: the table still has no writer and no seed, and the next addon choosing
  that shape gets the same table. The fix shape is a check at the cleaner, not a
  prompt. What shipped instead is a REPORT (`missingPopulation`), because *"no
  client write grant does not mean no writer"* — a seed, a function body, a job
  body or a client grant all count.
*(Two edit-path items closed here on 2026-09-20 — the component-deletion one
and the empty-frame one — moved up to the ladder's own section, because a
closed limitation left in a limitations list is a false negative about our own
product.)*
- **A WORKING `video-embed` IS INVISIBLE TO THE `data-slot` CENSUS (open).** It
  stamps the attribute on its FALLBACK branch alone, so **a video that WORKS is
  invisible and a BROKEN one shows up** — both consequences backwards. Two
  instruments go quiet: the `curl | grep -o 'data-slot=…'` reader and the css
  lane, which is required to target by `data-slot`. One attribute on the success
  branch's outer div; it is a kit file, so the deploy rolls the container.
- **EXISTING MODEL FUNCTIONS ARE NEVER RE-PINNED (open, kept SEPARATE at the
  owner's instruction).** Every model-written function on every site built
  before the `search_path` pin stays exposed, and those are exactly the
  `SECURITY DEFINER` ones granted to `anonymous`. **Not proposed, not written,
  no backfill run.** The shapes worth weighing: persist the body in `_meta` so a
  next change re-declares naturally (largest, and it puts model-written SQL into
  the stored spec); an `ALTER FUNCTION … SET search_path` sweep over `pg_proc`
  per site (needs a credential and the same preview/apply/verify discipline); or
  leave it on the reachability argument and record that the argument rests on a
  layer we do not own.
- **A REFUSED PHOTOGRAPH CANNOT NAME ITSELF TO ANYBODY WHO CAN ACT ON IT
  (open).** `genSitePhoto` throws `"photo " + status + " " + detail`,
  `makeSitePhoto` scrubs it onto `images.error`, and `imageNote` reads that
  field ONLY as a discriminator between four identical-looking placeholder
  outcomes — **it is never put on the reply**. The one surviving copy is
  `console.error` inside the container. So an empty provider balance, a wrong
  key, an outage, a timeout and a non-image answer all reach the owner as one
  sentence. *A failure that cannot name itself*, in the money path's decoration
  step.
- **SALVAGE CANNOT FIRE ON A NEW BUILD** and has not since `MAX_PAGES` became 1
  — the only page a new build has is the one page salvage will not replace. Both
  halves correct in isolation; nothing announced it. **Owner's call.**
- **THE QR RULE IS STRICTER THAN THE REST OF THE DESIGN STEP**, so a first build
  can almost never have one: `NEVER INVENT THE DESTINATION` while every other
  field invents placeholder detail freely. The machinery is not the limit; the
  rule is. **Owner's call.**
- **The availability calendar's own legend (open, live on `fretwork-1`).**
  `availability-calendar.tsx` prints "Each square is the night beginning on that
  date… Prices are per night for the whole property" — written for a
  self-catering let, now on a guitar diary. A legend the model must answer, or
  one that says nothing about the trade, fixes the class; a firmer sentence does
  not.
- **The price-unit mismatch (open, live on `ashgrove-1`).** A kit component
  documents "integer minor units"; the model feeds it major-unit rows, so one
  control says **£16.40** and the total says **£1880.00**. A branded type or a
  `deltaMinor` prop name fixes the class.
- **The raw-hex-colour finding (open, THIRD run running).** Runs 80, 82 and 83
  all reported it. Detected and reported on every build, never enforced, so it
  ships every time.
- **The dead-control finding (open).** On `northgroup-17` the stage filters,
  "New deal" and the deal rows are all `<a href="#pipeline">`, and 15 of 24
  in-page links point at the section they already sit inside — dead by
  construction, while the reply claims the filters run. A lint for a control that
  goes nowhere is the next thing.
- **Two client POSTs go to routes the Worker does not have (open).**
  `/api/site/scan` — the Security panel's "Run scan" button, which promises
  *"Opus is reviewing your code…"* and has no route (**a dead control that makes
  a promise**, and the sentence names Opus so even a real route would ignore the
  picker); and `/api/site/preview`, whose blob fallback means nobody notices.
  **Check first whether either is matched some other way** before deleting — the
  grep was for the literal string.
- **3D scenes ignore the theme colours (open)** — three.js cannot read oklch.
  Visible and low-contrast, NOT invisible.
- **Strings outside the page source are never translated (open, run 39).**
- **`env.EMAIL` daily quota is 200** across login codes AND every site's booking
  notifications. Worth watching, not yet a problem.
- **Static voice previews** — the owner drops MP3s at `public/voices/<name>.mp3`.
- **Real background removal** — needs a fal utility wired as an orchestrator
  step; blocked on a fal top-up.
- **Mobile layout for the app is deliberately NOT being done** (owner's call,
  desktop-first).
