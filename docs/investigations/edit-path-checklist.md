# Remaining edit-path checklist

## The short checklist (2026-09-27, after D1)

**D1 is closed by the owner** after an independent review of run 42:
- exactly one price changed, on both readers;
- the browser showed £4.60;
- the conditional put-back restored £4.50;
- the page and component source was unchanged;
- it cost 3 credits.

The reply's generic wording ("✅ Updated one entry in loaves." names the table,
not the change) is kept for the later model-written-replies work and is not
reopened.

Each list puts the material gaps first. The evidence is in the sections below,
and nothing in the first list is to be rerun.

**Demonstrated live**
- **The page rung.**
  - The quick writer: runs 9, 17 and 32.
  - The full writer: runs 11, 21, 24, 26, 34 and 37.
  - A component's wording and calculation: runs 21, 24 and 26.
  - The text guard and the judge letting a correct removal through: run 34.
  - A photographed page keeping both photographs, with the kit-heading fix:
    run 37.
- **A logo from an attachment, a picture reframe and a page move** (run 39),
  each published through the queue. The logo and the move were free.
- **One database row changed through the app and put back** (run 42, D1).
- **Second messages from one tab** after a finished job (run 39).
- **The machinery around every edit**, shown on every canary run and on
  recent deploys in runs 32–42:
  - the queue and billing;
  - the reply on screen;
  - the after-read at the job's own version;
  - the money closing exactly.

  Restoring a saved version is shown too (runs 20 and 22).
- **Older code, counted as path coverage only**: the look lanes, the menu, the
  site address and the text rung (2026-09-01 to 09-07).

**Tested only with supplied model output** (the route and the browser are
proven; a real model is not)
1. **The rules rung on a site with a database** (`edit-rules-backend`). It is
   the one edit rung that changes what a site accepts, and it has never run
   live: run 12 routed there and stopped on a defect fixed since. **This is the
   recommended next test** (below).
2. **A page removal** (`edit-page-verb`, `removal-door`). It has never
   published live. It makes no model call and the free restore undoes it, so
   it is the cheapest gap after the rules test.
3. **A protection refusing a real model's answer.** The photograph wall, the
   link and component judge and the text guard have only been seen letting a
   correct answer through (runs 34 and 37). The same holds for reply
   validation, and for the failure classification (a refusal never buys the
   full rewrite), which live has met only run 31's credit refusal.
4. **A named page other than the home page** on a look edit
   (`edit-page-target`). Live only on `/`.
5. **The data rung beyond one row**: adding, removing and reordering rows, and a
   site whose database link is blank.
6. **Two changes in one message** (`edit-page-once`, `edit-page-verb`), and a
   second message after a hop or a failure (`edit-lock`,
   `edit-result-display`, `edit-failure-paths`).
7. **The picture swap** (a new photograph into a slot).
8. **The stylesheet scope and the rule keys** (deploy 2161, with a real-browser
   control in the site build). The owner closed it without a live css-lane run.

**Still untested** (no live run, and no test drives it end to end)
1. **An older site's first schema change, through a real form.** A site built
   before 2026-09-13 gets column-scoped write grants on its next schema change.
   That is proven only on a local PostgreSQL, and D2 and D3 are parked. The
   recommended test makes that first change on its site, but it closes the only
   writable table, so the write grants are not exercised.
2. **What a real model decided, where nothing records it**: why a quick attempt
   did not publish, the writer's prompt, and the judge's and the text guard's
   verdicts. So far these are inferred from what published.
3. **Outside this checklist, listed so they are not lost**: the add-on through
   the browser since deploy 2154 (the last live add-on was run 53), and the
   photo add-on kind, which waits on fal funding.

Deferred by the owner and not counted: hydration (#418), translation,
model-written replies, and drafts surviving a refresh.

**The recommended next test: the rules rung on `lido-axes-b`, an existing
throwaway site.** One message, "We're fully booked, so stop taking bookings on
the website for now.", which should close that site's `bookings` table to
visitors.
- It costs about 3 credits.
- It needs no new build and no restore, and it changes nothing on a site
  anyone uses.
- Nothing is built or pressed.

The scope, the checks, the side effects and the recovery are in *the rules rung
— the recommended next test*, after Test 4.

## Remaining work after Test 3 (2026-09-26), and Test 4 prepared for approval

Test 3 (run 34) and the CSS-correction milestone (deploy 2161's batch) are
**closed by the owner**: no repeat run, no restoration, no further CSS work.
Runs 35 and 36 were free. **Test 4a's Part A ran as run 37** (your paid press,
8 credits), and **Parts B and C ran as run 39** (your paid press of the
canary's browser mode, 6 credits; run 38 was refused before signing in and
spent nothing). **Test 4a is closed by the owner** after an independent review
of run 39's workflow and evidence (2026-09-27), for the behaviours runs 37 and
39 demonstrated. The balance was 59 after Test 4a (read on the balance row at
2026-09-27 00:45Z) and is 56 after run 42 (read on the balance row at
06:13:03Z).

**The kit-heading defect is fixed, closed by the owner, and merged and
deployed**: main is `ab74d0d9` (deploy 2162, 2026-09-26 20:31 UTC, image
`369d7b1e5bae25b0`). It is **runtime-confirmed by your free press, run 35**
(21:08 UTC): both readers answered `ab74d0d94384` with image
`369d7b1e5bae25b0`. That press was also Test 4a's step 0, and step 0 ran again
as run 36 from the branch with the canary's reader fixed (below). The owner reproduced the
defect independently: the correct removal was refused with `SectionHeader`'s
`title` and accepted with the equivalent literal `<h2>`. The owner's review then
found one gap — a kit heading the page may not render (inside `{false && …}`,
`<div hidden>` or an unknown wrapper) still named its section — closed at
`5ec82214`, which is in the deploy. Test 4 below is split in two, each part with
its own approval; **4a is closed: its free step 0 ran as runs 35 and 36, Part A
passed as run 37, and Parts B and C passed as run 39, through the canary's new
UI mode (the real app in a real browser)**. **4b is now D1 alone** (owner,
2026-09-27): one price in the site's database, changed through the real app
and put back with no model call. It is built at `6602be37`, with tests, probes
and CI, and its free rehearsal passed as run 40. The owner then reproduced a
gap in the put-back: a change landing between its read and its write was
overwritten. **That is closed**: the write is now conditional in the owner
rows route itself, which is Worker code. The owner closed the correction after
review (165 focused tests), and it is **merged and deployed at `14df0225`
(deploy 2163, 2026-09-27 05:15 UTC, image `9038e90ab1d5d7fe`)**. **The fresh
free rehearsal on that deployment passed as run 41** (05:37 UTC; its preflight
is deploy 2163's runtime confirmation), and **the owner's paid press passed as
run 42** (06:03–06:05 UTC). The price went to £4.60 through the `data` layer and
showed on the order page. The canary's conditional write then put it back to
£4.50. It cost 3 credits (*the paid press ran as run 42*, in Test 4b). **D1 is
closed by the owner** after an independent review of run 42 (2026-09-27). D2
(the grants apply) and D3 (a real order) are parked as maintenance and
integration checks: applying grants through `grants preview` does not exercise
the rules rung. Step 0 (`grants preview` run 36286991932) is kept as evidence.
The rules rung is the recommended next test, on an existing throwaway site
(after Test 4).

### What is already shown live (credited, not rerun)

A read-only census of the **queued** edit jobs (`edit_jobs`, 2026-09-26,
07:40Z) lists every edit the queue has published: **51 jobs since
2026-09-01**. All of them are on fretwork-1 except one on fold-lane-bakery
(run 9).

**The census sees queued jobs only.** An edit that ran synchronously never
made a row: every edit before `EDIT_ASYNC_EVERYONE` opened on 2026-09-04, and
any later synchronous fallback. So a rung missing from it is missing from the
queue's record. That does not establish that no synchronous edit ever
exercised it.

| Rung or behaviour | Published through the queue |
| --- | --- |
| Page rung, quick writer | Runs 9, 17 and 32 (a block move, a one-line change, a section move); lane-sweep jobs on 2026-09-02 (shape, three). Run 9 kept both photographs, checked in a real browser. |
| Page rung, full writer | Runs 11, 21, 24, 26, 34 and 37 (34 and 37 on the current code; 34 with the text guard and the judge, 37 with the text guard on a page with photographs, both kept, and the kit-heading fix answering live); lane-sweep jobs on 2026-09-01/02 (three, components, purpose, tsx twice). |
| Look lanes | 32 jobs, 2026-09-01 to 09-07: css, brand, favicon, lang, langs, theme, description, wordmark, qr and behavior. One also placed a QR code through the page rung, the only live message that ran two rungs. |
| Menu | 2 jobs (the action lane), 2026-09-02. |
| Site address | 1 published and 1 refused and refunded, 2026-09-02. |
| Text | 1 job (gap-sweep run 10), 2026-09-02. |
| Logo | Run 39 (Test 4a's B1): a PNG attached in the real composer became the header logo, byte for byte; published free (`exempt`, no ledger row). |
| Picture (reframe) | Run 39 (B2): the named photograph moved to show the top, and nothing else; 1 credit. |
| Page move | Run 39 (B3): `/the-starter` → `/starter`, every link followed and the old address answers 301; published free (`exempt`). |
| Data (one row) | Run 42 (Test 4b's D1): one price, routed to the `data` layer, changed on the live database exactly as asked and shown on the order page, then put back by the canary; 3 credits. A row edit publishes no version, so this is an applied change, not a publish. |
| Second messages from one tab | Run 39: three messages from one browser tab, each after a finished job, each with its own job, reply and working composer. |
| Queue, billing, reply, after-read | Every canary run. Runs 33 and 34 ran on the current code. |

The jobs from 2026-09-01 to 09-07 ran on older code. They count as live
coverage of those rungs' paths, not as evidence about today's code, and they
are not rerun.

**Never published among the queued jobs inspected:** the rules rung and a page
removal. **The data rung changed its first row through the queue in run 42**
(2026-09-27). The census had 290 queued jobs since 2026-09-01, 197 of them
with a stored reply, and run 42's reply is the only one that names the `data`
layer or lists changed rows (read-only, 06:13Z). A row edit publishes no
version. **Run 39 (2026-09-27) was the first queued publish of the
logo rung, the picture rung and a page move**, and its logo and move jobs are
the only `exempt` jobs in the queue's history (a read-only count of
`edit_jobs` by billing state), so the free-rung path has now published through
the queue since `ed1e3b93` fixed its gate. Run 39 was also the first time
messages came from one browser tab rather than one scripted request each.

### Missing live evidence (not product defects)

Controlled tests cover each decision below, with supplied answers. What is
missing is a real model, the real browser or the live database.

1. **A second message in the same tab after a hop or a failure.** After a
   finished queued job it is shown (run 39). Controlled: `edit-lock`,
   `edit-result-display`, `edit-failure-paths`.
2. **The picture rung's swap** (a new picture into a slot). The reframe is
   shown (run 39). Controlled: `site-picture`, `edit-page-once`,
   `edit-failure`.
3. **The data rung beyond one row change.** Run 42 (D1) showed one price
   routed to `data`, changed live and put back. Still covered by controlled
   tests only (`site-apply`, `edit-failure`):
   - adding, removing and reordering rows;
   - a site whose backend reference is blank (`incomplete`).
4. **The rules rung on a site with a database.** Controlled:
   `edit-rules-backend`. Run 12 was blocked by a defect that has since been
   fixed. It is the recommended next test, on the existing throwaway site
   `lido-axes-b` (after Test 4); neither D2 nor D3 would cover it.
5. **The first schema change on a site built before 2026-09-13**, which
   re-emits every table's grants in column-scoped form. Proven on a real
   PostgreSQL 16 locally (`local-pg-grants`), but not observed on a live form
   submission. D2 and D3 would have shown it on fold-lane-bakery, and both
   are parked.
6. **Real-model behaviour in general.** Why a quick attempt did not publish is
   not on the wire, and the writer's prompt is not captured.
7. **The add-on through the browser since deploy 2154.** This is outside this
   checklist; the last live add-on was run 53 (2026-09-20). Not proposed now.

**Shown live since, by run 37 (Test 4a's Part A), and moved to the table
above:** the full writer on a page with photographs (both kept), and the
kit-heading fix with a real model.

**Shown live since, by run 39 (Test 4a's Parts B and C), and moved to the
table above:** an attachment sent from the real composer (the logo rung's
`{name, data}` shape, fixed in `51e39e3c`), the logo rung and a page move
publishing through the queue as `exempt`, the picture rung's reframe, and
second messages after a finished job in one tab.

### Reproduced product defects, still open

1. **Review #9:** a multi-step look reply names only the look, even when a
   picture, menu or address change went through beside it.
2. **An add-only answer ends the whole message.** A QR code, a 3D element or
   an "add a page" in the look door stops everything, so an ordinary change in
   the same message never runs (next-task 5).
3. **A half-moved site address.** If the second alias write of an address
   change fails, the old name is demoted and the new one is never written
   (next-task 5).
4. **The reply shows three problems of N** with no "and N more" (run 11).
5. **The quick writer's reply carries empty `changed` and `moved` lists** (runs
   17, 32 and 34). They are not an inventory.

**Fixed, merged and deployed in deploy 2162:** the text guard could not name a
section whose heading comes from a kit component's prop (the next section).

### Recorded separately when Test 4a closed (2026-09-27, not fixed)

Three findings from run 39, kept apart from the closed test and from each
other. None blocks anything; none is being worked on.

1. **The logo reply says "on every page".** The placeholder `/starter` page has
   no header, so the logo shows on four of the five pages. Reply wording.
2. **The message bubble in the thread does not show the attached picture.** The
   words show; nothing stores an attachment on a thread message. The picture
   itself was sent and used.
3. **The canary's job reader says `exempt` means "a founder account".**
   `billingMeans` predates the free-rung exemption (`ed1e3b93`), which is what
   run 39's two exempt jobs were. Harness wording, not the product.

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

- **The job census** above (read-only, queued jobs only).
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
  - the kit-heading defect reproduced — and on the branch with the fix, the
    same case publishes: 'Remove the "Today's bake" section from the home
    page.' on the real stored page, with and without the unused imports
    cleaned up, for route 2 + edit 3 in the rehearsal's prices.

  The rehearsal is scratch work and is not committed. The controlled tests
  already cover these decisions; this only pins them to this site's real
  pages.
- **The corpus heading census** behind the kit-heading fix.
- **The order form's fields**, read from the stored `order.tsx`: it writes
  `orders` with `customer_name`, `phone`, `loaf`, `pickup_date` and
  `pickup_time`, and reads `loaves`.
- **Data and rules were not rehearsed.** The uncertainty there is the router,
  since an adopted site sends it no table names, and the live database. Only a
  live run measures those.

### Test 4 — two parts, approved separately: 4a closed (runs 37 and 39); 4b is D1 alone, rehearsed free as runs 40 and 41, with its put-back write conditional; the paid press passed as run 42, and D1 is closed by the owner

Both parts run on fold-lane-bakery (Harbour Loaf): a database, three
photographs (two on the home page), five pages, and run 9's stored source
already read. **4a changes published pages only, and a free restore undoes all
of it. 4b writes to the site's database, which no restore reaches, so it has
its own approval and its own recovery.**

#### Test 4a — pages, photographs, an attachment and second messages

**Done on the deployed code: step 0 ran as runs 35 and 36, Part A passed as
run 37, and Parts B and C passed as run 39 (below).** Every press below is `edit-canary.yml`
(<https://github.com/canias7/isibi-app/actions/workflows/edit-canary.yml>, "Run
workflow"), with **"Use workflow from" set to `claude/help-needed-ehlwlj`**
until the canary's reader fix (below) is merged; a merge of it deploys nothing.
A branch press runs the branch's canary script against the live platform, and
the preflight checks the platform, so the two expectation boxes stay deploy
2162's. The GitHub form shows descriptions, not input names, so the boxes are
named here by their descriptions. **The two "Refuse to spend unless…" boxes
are the same on every press**, read off deploy 2162:
- "…the Worker reports this deploy sha…":
  `ab74d0d94384e85db252176eaca623ba131932a5`;
- "…a cold container reports this image id…": `369d7b1e5bae25b0`.

A press refuses to go on if either disagrees with the live platform, so none can
run against the previous build.

**Step 0 — your free press, first: the runtime confirmation, the restore target
and the before-read in one.**
- "Run the ONE paid edit as well": `no`.
- "What to change" and "READ ONE EXISTING JOB AND STOP": blank.
- "PUT ONE SAVED VERSION BACK, THEN READ IT AND STOP":
  `01789969693841-xqi8vs`. This is the version the site serves now, so nothing
  is posted.
- "The site to edit": `fold-lane-bakery`. "A second site…": `washhouse-3`.
- The two "Refuse to spend unless…" boxes: as above.

What it should print, and what each part establishes:
- `build-health 200 deploy=ab74d0d94384 image=369d7b1e5bae25b0` and `runtime
  200 … async=true runner=true`, with both readers agreeing. This is **deploy
  2162's runtime confirmation**: the live Worker answering, not the deploy
  reporting on itself.
- The balance, 73 unless something spends first.
- `RESTORE`: the site's version list, newest first, with
  `01789969693841-xqi8vs` as row 1 ("Live now") and not marked `NOT
  RESTORABLE`. Then **`RESTORED — the site already reported
  01789969693841-xqi8vs, so nothing was posted`**. That `RESTORED` is a no-op:
  the restore mode refuses an id the list does not carry or cannot restore, and
  posts nothing when the site already serves the id. So this press verifies the
  recovery target and changes nothing.
- The inventory, including `before/source.json`, which I compare with the five
  bodies below.
- It ends `RESTORE MODE — stopping before the paid edit. Nothing was charged.`

**Step 0 ran as run 35** ([36271891594](https://github.com/canias7/isibi-app/actions/runs/36271891594),
21:08:15 → 21:08:56Z, from `main`):
- **Deploy 2162 is runtime-confirmed**: `build-health 200 deploy=ab74d0d94384
  image=369d7b1e5bae25b0`, `runtime 200 … async=true runner=true`, both readers
  agreeing, every preflight check `ok`, and `ALL FREE CHECKS PASSED`.
- **The restore target is verified by the site's own list**: 5 versions, row 1
  `01789969693841-xqi8vs` ("Live now", parent `01789776828162-bdqv15`), not
  marked `NOT RESTORABLE`. Then `RESTORED — the site already reported …, so
  nothing was posted`.
- **Balance 73.** Every route answered `01789969693841-xqi8vs`, and the source
  read was complete (`reads` all true).
- **Four of the five bodies equal the record**: `index.tsx`,
  `the-starter.tsx`, `visit.tsx` and `gallery.tsx`.
- **`order.tsx` read back garbled, by the canary's own reader.** One en dash
  in its opening hours ("Wed–Sat 8–2") came back as three U+FFFD, so the read
  was 9,264 characters against 9,262. `call()` added each network chunk to a
  string, which decodes every chunk on its own. An en dash is three bytes, and
  a chunk boundary after the first yields exactly those three replacement
  characters (reproduced). The evidence that the stored page is intact:
  - the whole read held only those 3 replacement characters;
  - the route HTML, read another way, held none;
  - run 9's read of the same stored bytes held none — a broken reader can only
    garble bytes, never repair them — and nothing has written the page since.
- **The reader is fixed on the branch, not merged.** `call()` now collects the
  chunks and decodes them once; a guard drives the mechanism and checks the
  wiring (red on the unfixed script).
- **What it meant for Part A**: press step 0 once more from the branch, and
  `order.tsx` should read back as `4491c50d7cee45d8`. Run 36 did.

**Step 0 ran again as run 36, from the branch**
([36273488436](https://github.com/canias7/isibi-app/actions/runs/36273488436),
21:35:58 → 21:36:38Z). The checkout step fetched and checked out exactly
`8996cc1a`, the branch tip carrying the fixed reader.
- **The same platform**: `build-health 200 deploy=ab74d0d94384
  image=369d7b1e5bae25b0`, `runtime 200 … async=true runner=true`, both
  readers agreeing, every preflight check `ok`, `ALL FREE CHECKS PASSED`.
- **The same restore no-op**: the same five versions and `RESTORED — the site
  already reported …, so nothing was posted`. Its `restore.json` is
  byte-identical to run 35's.
- **Balance 73.** Every route answered `01789969693841-xqi8vs`, and the source
  read was complete.
- **All five bodies equal the record, byte for byte**: `index.tsx`
  `2c9421cf728d9823`, `order.tsx` `4491c50d7cee45d8`, `the-starter.tsx`
  `e1172965a3644f5f`, `visit.tsx` `0963e3bc45f1d949`, `gallery.tsx`
  `1c940e38d7fe6ab0`. The path set is the same and there are no components.
  - The whole read holds **0** replacement characters; run 35's held 3.
  - `order.tsx` is 9,262 characters and byte-identical to run 9's
    after-read.
  - The only difference from run 35's inventory is `order.tsx`'s character
    count, 9,264 → 9,262. The five route pages are identical to run 35's once
    digit runs (the render times) are masked.
- **So the reader fix is proven live, and the before-state Part A compares
  against is complete.** The supplied-answer rehearsal, re-run on the branch
  checkout, reads 13 of 13; its input (run 9's after-read) is byte-identical to
  run 36's read on all five bodies. That proves the route, never the model.
- **Next was Part A, from the same branch**: it ran as run 37 (below).

**The before-inventory, read free** (2026-09-26, 20:47–20:50Z):
- **Version.** All five routes (`/`, `/gallery`, `/order`, `/the-starter`,
  `/visit`) answer `x-site-version: 01789969693841-xqi8vs`.
- **`/`, in a real Chromium.** Every request was answered from a TLS-verified
  fetch, and nothing was typed or submitted.
  - Headings: Harbour Loaf · Fed every morning since we opened · Today's bake
    · Today's bake (the loaf list's own `h3`) · Order a loaf for collection.
  - 201 visible words. The loaf list shows six loaves with prices (Sea Salt
    Focaccia £4.50).
  - Both photographs load: 2400×1792, shown at 976×549 and 720×540. The boule
    photograph is at `object-position: 50% 50%`.
  - The header draws an SVG mark and "Harbour Loaf", with no image.
  - 0 console errors, 0 page errors, 0 failed requests.
- **The other pages.**
  - `/gallery`: Our Gallery · Photographs of the bakery's work; seven picture
    frames, all placeholders; 77 words.
  - `/order`: Order a loaf · Pick a loaf and a collection slot; 165 words.
  - `/visit`: Come to the bakery · The shutters and the street · Order a
    collection so we hold a loaf; one photograph and the gallery QR code; 116
    words.
  - **`/the-starter` is a salvage placeholder**: "This page isn't finished
    yet", 30 words, and no header.
- **Links to `/the-starter`** in the server HTML: nine (`/` 3, `/gallery` 2,
  `/order` 2, `/visit` 2). They come from the header menu, the footer and the
  home page's story block.
- **The stored bodies** are run 9's after-read. No job has touched the site
  since run 9 (the job table), and the live version is run 9's:
  - `index.tsx` `2c9421cf728d9823` (4,389 characters);
  - `order.tsx` `4491c50d7cee45d8`;
  - `the-starter.tsx` `e1172965a3644f5f`;
  - `visit.tsx` `0963e3bc45f1d949`;
  - `gallery.tsx` `1c940e38d7fe6ab0`;
  - no components.

  Step 0 re-reads them byte for byte.

**Part A — your paid canary press: the full writer on a page with photographs,
and the kit-heading fix, live.**
- **The form.**
  - "Run the ONE paid edit as well": `yes`.
  - "What to change": `Remove the "Today's bake" section from the home page.`
    That is 53 characters, all ASCII (straight quotes), sha256
    `26b7101c225656db1ec13ccff5873bd7fb64fca28ea79f2a1ad81bbbd5bfa9be`.
  - "READ ONE EXISTING JOB AND STOP" and "PUT ONE SAVED VERSION BACK": **blank**.
    A named version turns spending off.
  - "The site to edit": `fold-lane-bakery`. "A second site…": `washhouse-3`.
  - The two "Refuse to spend unless…" boxes: as above.
- **Why this sentence.** The section's heading is `<SectionHeader
  title="Today's bake">`, the case the fix exists for. The section holds three
  literal sentences (the loading error and the two empty-state lines), so the
  text guard must see them authorized by the heading. The quick writer cannot
  remove words, so the full writer runs, on a page whose two photographs sit in
  other sections.
- **It counts as the test only if** the request sha matches; the press's own
  before-read equals the five bodies above; the preflight passes; and a stored
  reply arrives.
- **Expected.**
  1. Routed to the page rung for `/`, directly or through `look`. This is
     expected, not guaranteed: a model routes it.
  2. The full writer publishes: `tweak` is absent, with `tweakUsage` (a quick
     attempt, which cannot remove words) and the full writer's `usage`.
  3. It publishes at the job's own version, and `compare.json` reads VERIFIED.
  4. `index.tsx` loses exactly the `<section>` holding `<SectionHeader
     title="Today's bake">`: 1,489 characters, covering the heading, the
     loading, error and empty lines, and the loaf list.
     - The imports it leaves unused (`Empty`, `MenuSection`, `SectionHeader`,
       `Skeleton`, `useRows`), the `Loaf` type and the `loaves` read may go
       too. That is noted, not failed.
     - Everything else stays byte-identical. That includes both `<SafeImage>`
       elements and the header menu's "Today's bake" item. That item is a link
       to `/` in `CHROME`, outside the section; no guard protects it, so the
       source comparison is what checks it.
     - The other four pages stay byte-identical.
  5. There is no `keepUsage`, since no literal link and no own component is
     lost. `problems` is empty, because the site's schema declares `loaves`:
     run 51's stored reply on this site read `backend: "ready"` and `problems:
     []` over a changed `index.tsx` that reads it.
  6. The reply is "✅ Updated /.", with the render check's note passed on.
  7. The balance moves by the routing charge plus the edit. The ledger's one
     reserve for the job equals the edit's cost.
  8. The live page, in a real Chromium (mine, free):
     - the headings are Harbour Loaf · Fed every morning since we opened ·
       Order a loaf for collection;
     - there is no "Today's bake" heading, no loaf name and no price;
     - visible words go from 201 to **82**: exactly the section's 119 go;
     - both photographs load, with no console errors or failed requests;
     - the other four pages read as before.
- **What a different result would mean.**
  - `prose-preservation`: either the fix is not what answered (check the
    deploy) or the writer also lost other literal prose. The refused answer is
    not stored, so which one is not established.
  - `tweak: true`: the quick writer published a removal of words, which it
    must never do.
  - `withheld` with `photosBlocked`, or `photosKept`: the writer dropped a
    photograph and the wall refused or restored it — the protection working
    live.
  - A reply calling `loaves` undeclared: the page rung's schema read, not the
    edit.
- **Cost:** route 2 + edit about 8–10, so about 10–12 (8–15), plus about 1
  if it is routed through `look`. An estimate, not a cap.

**Part A ran as run 37 and passed**
([36274691376](https://github.com/canias7/isibi-app/actions/runs/36274691376),
21:57:49 → 22:02:24Z, your paid press from the branch at `6ce873fc`). It counts
as the test: the request sha matches (`26b7101c…`, 53 characters, `source:
CANARY_INSTRUCTION`), its own before-read equals the five bodies, the
preflight read deploy 2162, and a stored reply arrived (HTTP 200 under
`x-gf-edit: final`, after 220.2 s, 65 polls, 0 transient). Against the expected
list:
1. **Routed through `look`.** Given the five pages, the router answered
   `intent=edit layer=look page=/` in 16.1 s for 2 credits (`6,769 in / 19
   out`). The lane picker chose `components` (`2,255 in / 20 out`), which
   reaches the page rung for `/`.
2. **The full writer published.** `tweak` is absent; `tweakUsage` is `1,894 in
   / 56 out`, a quick attempt that did not publish (why is not captured); the
   full writer is `15,257 in / 930 out`. The look door's reply lists all three
   billed calls in `usage.langUsage`.
3. **At the job's own version, VERIFIED.** `01789969693841-xqi8vs` →
   `01790460007724-qwlcka`, minted 22:00:07.724Z (0.46 s after the reserve);
   `published_at` 22:02:11.971Z. The after-read's wait matched on its first
   read.
4. **Exactly the section, and the code only it used.**
   - `index.tsx` went 4,389 → 2,435 characters (`2c9421cf728d9823` →
     `9ae87b30a1fa5d4a`). It is **byte-identical to the removal built by hand
     as the control**: the section's 39 lines, plus the `useRows`/`Row`,
     `Empty`, `MenuSection`, `SectionHeader` and `Skeleton` imports, the `Loaf`
     type and the `loaves` read.
   - 306 tokens were lost, all from those lines, and 0 gained.
   - Both `<SafeImage>` elements and the header menu's "Today's bake" item are
     unchanged. The other four pages are byte-identical, and there are no
     components before or after.
   - The checker was proved on six controls first: two correct removals pass,
     and collateral prose, a removed menu item, no change and a reworded line
     are each flagged.
5. **No `keepUsage`, and `problems: []`**, as expected. The text guard let the
   section's three literal sentences go, with the section named only by the kit
   heading: the case refused before deploy 2162. The verdict is inferred from
   the publish; it is not on the wire.
6. **The reply is "✅ Updated /."** No render note came with it; a render
   report rides on the reply only when the check failed or found something.
7. **Money closes exactly: 73 → 65 = route 2 + edit 6.** The ledger's one row
   for the job is a reserve of 6 (`balance_after 65`, ref `<job>#1`,
   22:00:07Z), with no refund, and the job reads `done`, `finalized`, cost 6.
   That is the bottom of the quoted 8–15.
8. **The live pages, in a real Chromium** (before at 21:58:39Z, after at
   22:02:27Z):
   - `/` reads Harbour Loaf · Fed every morning since we opened · Order a loaf
     for collection;
   - its text is the before text with exactly the section cut out: 201 → 82
     words, 0 gained, no loaf name and no price;
   - both photographs load at the same sizes, and the home page no longer asks
     for `/data/loaves`;
   - the other four pages read exactly as before;
   - there are 0 console errors, page errors, failed requests or non-OK
     responses on any page.

**What run 37 establishes**: on one sentence and one site, a real model's full
page rewrite removed exactly the named section on a page with photographs, both
photographs stayed, and the kit-heading fix let the correct removal through.
**Not established**: the writer's prompt, why the quick attempt did not publish,
and the text guard's own verdict. The link-and-component judge and the
photograph wall had nothing to protect here, so neither was exercised.

**Part B — the real app in a real browser, driven by the canary's new UI
mode: three messages, one tab, no reload.** No existing workflow drove the
signed-in app, and the session has no owner credentials and cannot dispatch.
A new workflow file would have no Run button until merged, so this is a MODE of
the existing canary, like the restore mode. It is on the branch, so a branch
dispatch offers its box (`ui_scenario`).
- **What it does:**
  - It signs in the way the canary already does: a magic link minted with the
    service key, then verified.
  - It plants that session where `auth.js` keeps one (`zephyr_session_v1`),
    only for gofarther.dev itself, before the page's first script runs. The
    site's own preview frame gets nothing.
  - It opens gofarther.dev/projects in a real Chromium, and opens Harbour
    Loaf's card on the start screen.
  - It attaches `test/fixtures/ui-logo.png` through the + button's own file
    chooser. The file is a 240×240 PNG of a loaf, 1,254 bytes, sha256
    `2cc633d73b2d5ab38d29d94cf15c9ce67980a2401ee005f99e89e0781a4c3df5`.
  - It types each message and presses Send only when the previous reply is on
    screen and the composer is idle: the busy flag down, Send drawn and live,
    no Stop button, no "Working" row, a box that takes typing.
  - After each reply it types into the box and checks Send is live, so
    "usable again" is a reading, not an assumption.
  - It records each reply exactly as shown, and each routing and edit request
    and reply, with an attachment reduced to its name, size and sha256. It
    also records every job each message filed and the balance before and after
    each message.
  - After the last message it finds each job's published version in the
    site's own list, and waits for the site to report the last one. It then
    takes the byte-level after-read, checks each publish was built from the one
    before it, and reads each job's row and ledger lines.
- **Where it stops, sending nothing more:**
  - a free check that failed;
  - the sign-in gate, another account, or no card for the site;
  - a file that never lands in the attachment strip, or words that do not land
    in the box;
  - a composer that is busy before a message;
  - a reply that does not come within 12 minutes;
  - a balance it cannot read, or 15 credits spent (checked before each
    message).

  Without `spend = yes` it stops before the first Send: a rehearsal that shows
  the app opens signed in and the file attaches.
- **What it blocks in the page:** any add-on, build or full-rewrite request.
  That is the paid work this scenario never asks for, so the request is
  aborted before it leaves the browser and recorded as BLOCKED. Whatever the
  page then says is the harness's doing, and the record says so.
- **Its limits, stated:**
  - The budget is checked between messages, so one message's own cost is never
    cut off mid-way. That cost includes a hand-off to another edit layer, which
    the page makes as a second edit request with its own job, as the real app
    does.
  - Every other request goes to the live Worker. So the replies are the real
    ones, and so is the money.
  - A blocked request fails the run and does not stop the scenario: the page
    answers it with its own not-knowing sentence, and the next message still
    goes.
- **Proven before any press, and what that proof is:**
  - Locally, against the real app's code: the live gofarther.dev files served
    into a real Chromium, with every API call answered in the page. It ran the
    three messages, a rehearsal, a refused session, a message misrouted to the
    add-on (blocked), and a job that never finished. That proves the driver,
    never the live platform's answers.
  - 22 unit cases, through a stand-in page that forces every stop; unit CI
    green on `ca3a6fae` (8,040 tests), all 22 found passing by name.
  - Targeted probes: 33 mutants, all killed; 3 comment-only controls, all
    surviving.
  - The canary's balance reader used to read an answer it could not parse as a
    balance of 0, which would switch off the budget stop. It answers "unknown"
    now, and unknown refuses (5 more probes, all killed).

Everything in the last column is read afterwards, free: the job rows and the
ledger (read-only), and the live pages in a real browser.

| # | Send exactly | Expected rung | Expected reply | Established afterwards | Credits |
| --- | --- | --- | --- | --- | --- |
| B1 | Attach a PNG or JPEG under 2 MB (not an SVG) with the + button, then `Use this picture as the logo.` | logo — expected, not guaranteed | "✅ That's your logo in the header now, on every page." | The header draws the image instead of today's SVG mark, on the four pages that have a header; `/the-starter` is the placeholder and has none. **The free path is established only by the job's own record**: its stored reply names the `logo` layer, its `billing` is `exempt`, and no ledger row names it. A different layer is a routing finding, not a logo-rung result. | 2 |
| B2 | `Show more of the top of the photo of the sourdough boule cooling.` | picture | "✅ Moved “A sourdough boule cooling after the morning bake” to show the top." | Only that image moves, from `object-position: 50% 50%` to the top; both photographs still load; the job's one reserve equals its cost. | ~3 |
| B3 | `Move the starter page to /starter.` | page (move) | "✅ Moved /the-starter to /starter." | `/starter` answers 200 with the same placeholder page; `/the-starter` answers 301 to `/starter`; no page links to `/the-starter` (nine do today). `exempt` only if the stored reply shows the page rung and the ledger holds no reserve; through `look`, the lane picker's call is billed instead. | 2 (3 through look) |

- **Second messages.** B2 and B3 each follow a finished job. Each must get its
  own job and reply, and the send box must come back after each. A message
  that is routed and then hangs means the per-ask latch has failed. The job
  rows show one job per message, in order.
- **Cost:** about 7–8 in total. The mode stops before a message once 15 are
  spent.
- **The press** (`edit-canary.yml`, "Use workflow from" = the branch
  `claude/help-needed-ehlwlj`, where the new box exists):
  - "RUN A SCENARIO THROUGH THE REAL APP IN A REAL BROWSER…"
    (`ui_scenario`) = `4a-part-b`;
  - "Run the ONE paid edit as well (yes/no)" (`spend`) = `yes`, which in this
    mode sends the scenario's messages;
  - "The site to edit…" = `fold-lane-bakery`; "A second site…" =
    `washhouse-3`;
  - "What to change…", "READ ONE EXISTING JOB…" and "PUT ONE SAVED VERSION
    BACK…" blank;
  - "Refuse to spend unless the Worker reports this deploy sha…" =
    `ab74d0d94384e85db252176eaca623ba131932a5`;
  - "Refuse to spend unless a cold container reports this image id…" =
    `369d7b1e5bae25b0`.

  The same form with spend = `no` is a free rehearsal. The artifact holds
  `ui.json`, `ui.txt`, a screenshot after each message, `job-<id>.txt` for each
  job, and the before and after source.

**Part C — the byte-level after-read, now taken by the UI mode itself.** Once
its last message has published, the mode waits for the site to report that
version and reads every stored body, so the whole sitting is compared byte for
byte. A separate free press is needed only if its chain reads UNVERIFIED. It
would use step 0's form with "PUT ONE SAVED VERSION BACK" **blank**; with the
version named, the press would restore it. What the after-read should show:
- `index.tsx` should change only by Part A's removal (known to the byte: run
  37's `9ae87b30a1fa5d4a`), B2's `focus="top"` and B3's links;
- `the-starter.tsx` should become `starter.tsx`;
- the other pages should change only by B3's links.

**Run 38 was refused before it signed in, and spent nothing**
([36281161831](https://github.com/canias7/isibi-app/actions/runs/36281161831),
2026-09-27 00:00Z). "The site to edit" was left at `fretwork-1`, and the
scenario is written for `fold-lane-bakery`, so the canary refused with exit 2
before any network call: *REFUSING THE UI MODE: scenario "4a-part-b" is written
for fold-lane-bakery, and the site box says fretwork-1*. The balance stayed 65,
no job or ledger row appeared, and both sites kept their versions. That is the
scenario-to-site wall working live.

**Parts B and C ran as run 39 and passed**
([36281551801](https://github.com/canias7/isibi-app/actions/runs/36281551801),
00:07:42 → 00:17:14Z, your paid press from the branch at `403f294e`; the
canary step took 8m43s). It counts as the test: the preflight read deploy 2162
(`ab74d0d94384`, image `369d7b1e5bae25b0`, async and runner true) with both
expectations matched, every free check passed, its own before-read (all reads
true) equals Part A's after-read on all five bodies, and each message got a
stored reply. Against the table:
- **B1, the logo — the logo rung, as expected.** Routed `layer=logo` for 2
  (`6,763 in / 15 out`). The file reached the edit request byte for byte
  (1,254 bytes, sha256 `2cc633d7…`). The job published free: its stored reply
  names the `logo` layer, `billing` is `exempt`, and no ledger row names it.
  The reply is the table's, word for word: "✅ That's your logo in the header
  now, on every page." 167 s from Send to reply.
- **B2, the reframe — the picture rung.** Routed `layer=picture` for **1**:
  that routing call read 7,168 prompt tokens from the cache and 117 fresh,
  where the other two read 512 and about 6,760. One model call (`1,401 in / 41
  out`), cost 1, `finalized`, and the job's one ledger row is that reserve of
  1. The reply is the table's, word for word. 164 s.
- **B3, the move — the page rung, directly.** Routed `layer=page
  page=/the-starter rename=/starter` for 2 (`6,764 in / 27 out`). The stored
  reply names the page layer with `pageOps` `[{page: "/the-starter",
  renamedTo: "/starter"}]`; `exempt`, no ledger row. The reply is the table's,
  word for word: "✅ Moved /the-starter to /starter." 147 s.
- **Second messages.** B2 and B3 each followed a finished job, and each got its
  own job and reply: one job per message, in order. After every reply the
  composer was usable again (busy down, Send drawn and live, no Stop, no
  "Working" row, and a box that took typing). Nothing outside the scenario was
  started (no BLOCKED request), and the page logged 0 console errors and 0 page
  errors.
- **Money closes exactly: 65 → 59 = routing 2 + 1 + 2, plus one edit of 1**, so
  6, under the quoted 7–8. The ledger holds one row for the three jobs (B2's
  reserve); a routing charge writes no row, as recorded.
- **The chain is VERIFIED**: `qwlcka → 4f73ev → pi9qwd → 8btpep`, each built
  from the one before, with the after-read taken at `8btpep`. The versions were
  minted at 00:09:18.987Z, 00:12:10.063Z and 00:14:49.054Z. A separate watch of
  the live site's version header saw them serve at 00:11:44Z, 00:14:24Z and
  00:17:06Z.

**Part C, read by run 39 itself: every stored page is exactly the expected
page, byte for byte.** The expected set was built by hand from the before-read,
the way each rung writes:
- B2: ` focus="top"` inserted just after `<SafeImage` on the boule's element;
- B3: every quoted `"/the-starter"` changed to `"/starter"` on all five pages
  (the route declaration included), and `the-starter.tsx` renamed
  `starter.tsx`;
- B1 changes no page: the logo lives in the stored look.

`index.tsx` goes 2,435 → 2,439 characters (`51b5af6af6ee25ca`); `order.tsx`
(`4ead778eea41faaf`), `gallery.tsx` (`4e8b82aa901741e0`), `visit.tsx`
(`bdb02abecad96c56`) and `starter.tsx` (`37fb0e176f22a44b`) each lose four
characters; there are still no components. The checker was proved on six
controls first: the correct set passes, and a missing reframe, a link left
behind, a collateral word change, the wrong focus value and an unrenamed file
are each flagged.

**The live site, in a real Chromium over TLS-verified live bytes** (before at
00:10:31Z on `qwlcka`, after on `8btpep`):
- the four pages with a header now draw the logo instead of the name, as a
  240×240 image shown at 28×28 with "Harbour Loaf" as its alt text, and **the
  bytes each page loaded are the test image byte for byte** (1,254 bytes,
  sha256 `2cc633d7…4c3df5`). The stored file's name is that hash's first 32
  hex digits, which is how `uploadName` names every upload;
- only the boule photograph moved: object-position `50% 50%` → `50% 0%`. The
  shopfront photograph, the visit page's photograph and the QR code are
  unchanged;
- `/the-starter` answers **301 → `/starter`**, `/starter` answers 200 with the
  same placeholder page, and the sitemap lists `/starter`. Links to
  `/the-starter` went 9 → 0 in the served HTML, and links to `/starter` 0 → 9;
- each page's rendered text, headings and pictures are otherwise identical,
  with 0 console errors, page errors, failed requests or non-OK responses.

**What run 39 establishes**: on one site, through the real app in a real
browser, a picture attached in the composer became the logo byte for byte; a
real model reframed the named photograph and nothing else; a page moved with
every link following and the old address redirecting; and three messages from
one tab each got their own job, reply and working composer. The logo rung, the
picture rung and a page move each published through the queue for the first
time, and the free-rung exemption published twice. **Not established**: a
second message after a hop or a failure, the picture swap, the data and rules
rungs (4b), and the writer's prompt.

**Found, not changed:**
- **The table's B1 row was wrong about the old mark.** It said the header
  would draw the image "instead of today's SVG mark". The old mark was the
  name in plain text; the header's one SVG is the mobile menu icon, before and
  after.
- **The canary's job reader names only one cause for `exempt`.** It prints
  "exempt — a founder account takes no debit and writes no row", and this
  account is not a founder (its routing calls were debited). Here `exempt` is
  the free rung: a step that makes no model call never reserves, so the
  publish exempts its job (the `publish:exempt:ok` mark on the matching
  traces). `billingMeans` in `scripts/canary-read-job.mjs` dates from when
  only a founder was exempt.
- **The logo reply says "on every page"**, and the placeholder page has no
  header, so the logo shows on four of the five. The table predicted this; it
  is a wording note.
- **The message bubble in the thread shows the words and not the attached
  picture**: nothing stores an attachment on a thread message, as recorded.
- **The workspace opened reading "Previewing last saved version"** (the page
  list not loaded yet) and read "5 pages" after the first reply. Every routing
  call carried the site's real page list, the first one included.

**Recovery for 4a — free, with no model call, and verified.** Use step 0's form
exactly: "PUT ONE SAVED VERSION BACK" = `01789969693841-xqi8vs`.
- **Why that version:**
  - every route answered it before Part A, and it is run 37's parent;
  - its first 14 digits mint it at 2026-09-21 05:48:13.841Z, inside run 9's job
    (created 05:47:43Z, published 05:50:09Z);
  - run 9 is the last job on the site;
  - step 0 shows the site's own list carrying it as restorable.
- **What it puts back, read in code** (`restoreVersion`):
  - the pages and components;
  - the look, whole — including the logo mark, since the logo rung stores its
    upload as `look.wordmark`;
  - the stylesheet;
  - the version's own script and head.

  So `/starter` stops answering and `/the-starter` serves again. The uploaded
  logo file stays stored, unused.
- **It survives 4a's publishes.** Pruning keeps the newest 10 builds plus the
  live one and its parent, and 4a makes four publishes (five with a correction
  round).

**4a total:** Part A cost 8 (run 37) and Parts B and C cost 6 (run 39): 14 in
all, against an estimate of about 17–20. The balance is 59 (read 2026-09-27
00:45:33Z). The site keeps 4a's changes; the recovery above undoes them for
free if you want that.

#### Test 4b — the database: D1 alone, built and rehearsed free as run 40; its put-back write made conditional, deployed in 2163 and rehearsed free again as run 41; the paid press passed as run 42 (2026-09-27) and D1 is closed by the owner; D2 and D3 parked; step 0 kept as evidence

**Narrowed by the owner (2026-09-27):** *"separate maintenance from edit-path
acceptance: applying grants through grants-preview does not exercise the rules
rung."* So 4b is now **D1 alone**: one row changed through the real app, and
put back with no model call. **D2** (the grants apply) and **D3** (one real
order under the new grants) are **parked**. They are a maintenance check and an
integration check, and neither closes rules-edit coverage. The rules rung is
the recommended next test, on an existing throwaway site, in the section after
Test 4.

**Free checks already done (2026-09-27, 01:31–01:39Z):**
- **The site's job history** (read-only, `edit_jobs`): its database has had no
  schema change since it was built on 2026-08-21. The one later add-on (run
  51, 2026-09-19) designed a page, a QR code and a photograph, and the add-on
  applies a schema only when it designs a backend. So its client write grants
  are still the table-wide form from before 2026-09-13, and the first schema
  change on it (any rules request, or an add-on with a table) will change more
  than it was asked to.
- **A visitor's read of the data API:** `loaves` answers 200 with six rows (ids
  1–6); the Sea Salt Focaccia is id 6 at 4.5, and no row has a photo. `orders`
  answers 403 (`permission denied for table orders`). Those six rows, as read,
  are D1's record: its fresh baseline is compared with them, and
  `4b-d1-restore` compares a visitor's read with them.
- **The live order page in a real Chromium** (version `8btpep`): it lists the
  six loaves with prices, the focaccia at £4.50. The form was filled and
  submitted with every write blocked inside the browser, so nothing was sent.
  It builds exactly one request: `POST /api/db/fold-lane-bakery/data/orders`
  with an `Idempotency-Key` header and the body `{customer_name, phone, loaf,
  pickup_date, pickup_time}` (the loaf as its id, a number). There is no
  spam-check field and no other column.
- **`grants preview` is the only existing reader of this site's stored schema
  and grants** (`backend repair` is scoped to five other sites). The session's
  dispatch of it answered 403, so step 0 was your press.

**Step 0, kept as maintenance evidence: `grants preview` run
[36286991932](https://github.com/canias7/isibi-app/actions/runs/36286991932)
(#1 in the list), the owner's free press, 2026-09-27 01:55:29Z, from `main` at
`ab74d0d9`.** It read this site's grants and what `grants preview` would do
with them, and met the gate D2 had: `orders` lists exactly the five form
fields under "would grant". **It is not edit-path coverage**: `grants preview`
writes grants directly and never goes through an edit.
- **It wrote nothing.** The env block reads `MODE: preview` and `SLUG:
  fold-lane-bakery`. The apply guard and the rollback download were both
  skipped, and the script's one writing path runs only in apply mode.
- **What it read**, verbatim: `fold-lane-bakery: 2 table(s), 1 carrying a
  table-wide client write`.
  - `ok loaves [read=public write=none] now: (no table-wide write)`.
  - `NEEDS orders [read=none write=anyone] now: anonymous INSERT,
    authenticated INSERT`, and `would grant: customer_name, phone, loaf,
    pickup_date, pickup_time`.
  - No missing-column note, no warning, and `0 site(s) could not be read`.

  **So the columns it would grant are exactly the five the form sends**, no
  more and no fewer.
- **The saved grants** (artifact `grants-before-state`, id 10920728641, 569
  bytes zipped, a 1,980-byte JSON, kept until 2026-12-26). Downloaded and read:
  - `loaves`: SELECT for `anonymous` and `authenticated`, table-level.
  - `orders`: INSERT for both roles, table-level.
  - No column-level grant and no other privilege for either role, so a
    visitor has no UPDATE or DELETE anywhere and no SELECT on `orders`.
- **D2's statements are known before it runs.** The preview records, per
  table, what an apply would issue.
  - `loaves`: `REVOKE ALL` from both roles, then `GRANT SELECT` to both. That
    is the same end state it has now.
  - `orders`: `REVOKE ALL` from both roles, then `GRANT INSERT
    ("customer_name", "phone", "loaf", "pickup_date", "pickup_time") ON
    "orders"` to each.
- **Its rollback is known too.** It was computed offline with the script's own
  `grantsFromAcls` over the downloaded file, with no database involved.
  - `loaves`: the same four statements.
  - `orders`: `REVOKE ALL` from both roles, then `GRANT INSERT ON "orders"` to
    each. That is today's table-wide form, exactly.

**D1 — a row, through the real app: built at `6602be37`, rehearsed free as run 40 (below); the put-back's write made conditional since (below), deployed in 2163, and rehearsed free again on that deployment as run 41 (below), which passed. The owner's paid press passed as run 42 (below), and the owner
closed D1 after an independent review of it (2026-09-27).** A new
scenario of the canary's UI mode, `4b-d1-price`, on fold-lane-bakery. One
message: "In today's bake list, change the Sea Salt Focaccia's price to
£4.60." (68 characters, 69 bytes, sha256 `550cf87497ef7a8f…`).

What the run does, in order:
1. The canary's free checks and its before-read, as on every run.
2. It signs in to the real app in a real Chromium, opens the site's card and
   types the message.
3. **Whether the put-back can be conditional** (added 2026-09-27, below). One
   PATCH of row 6 that no row can meet: `{"$set": {"price": "4.5"}, "$if":
   {"id": 0}}` asks for a row whose id is 6 and 0 at once. It changes nothing
   on any Worker. One with the conditional write runs the UPDATE, matches
   nothing and answers 409 conflict. One from before it finds nothing it can
   write in that body and answers 400 "nothing to update". **A paid run is
   sent only after a 409** (or a 404 if the row is gone). Anything else stops
   it before Send; the rehearsal reports the answer.
4. It reads the order page in a browser tab of its own, whose wall lets only a
   GET out, so the visitor's page can submit nothing. The focaccia's card must
   read £4.50.
5. **The fresh baseline, immediately before Send.** Both readers: the owner
   rows route (what the database holds) and the visitor data route (what the
   site's pages read, kept as text). Both must find row 6, named "Sea Salt
   Focaccia", with the price exactly 4.5. Otherwise nothing is sent and the
   run says why. The proposal's six-row record is compared with the baseline
   too; a difference is reported, not refused.
6. **Send.** The page's wall is a positive list of writes: the routing call,
   and one edit of this site at the `data` layer. Anything else (text, page,
   rules, look, the add-on, a build, the full rewrite, any other write) is
   aborted in the browser, recorded, and fails the run. A misroute costs the
   routing call and changes nothing. (The probe is the canary's own request,
   not the page's, so the wall never sees it.)
7. It waits for the reply, then reads both readers and the order page again.
8. **The recovery, with no model call.** It reads both readers once more, just
   before writing. Only if row 6 still reads exactly 4.6, the value this test
   set, does it write that one field back to the baseline's own value, through
   the owner rows route the Data panel uses, **as a conditional write**:
   `{"$set": {"price": 4.5}, "$if": {"name": "Sea Salt Focaccia", "price":
   4.6}}`. Postgres writes it only if, when the write runs, row 6 is still
   named that and still reads the value just read. Then it reads both readers
   and the order page back.

What the recovery refuses rather than writes:
- A value nobody here set (4.7, say, from a concurrent change), a missing row,
  or a row no longer named "Sea Salt Focaccia". Said, and nothing is written.
- Every other difference (another field, another row, a row added or gone).
  Reported, and never written back.
- A reply that never came. The job may still be writing, so the recovery is
  skipped and the run says to press the recovery scenario once the job has
  finished.
- **A write that lands between the recovery's read and its own write.** The
  recovery's write is conditional (below): Postgres writes the price only if,
  when the write runs, row 6 is still "Sea Salt Focaccia" and still reads
  the value the recovery just read. Otherwise nothing is written, and the run
  says CONFLICT and fails. It is never retried and never called restored.
  (This bullet used to record the gap as a limit; the owner reproduced it and
  had it closed, 2026-09-27.)

The checks (each one fails the run):
- **The exact request:** the routing call carries the message byte for byte;
  there is exactly one edit POST, at the `data` layer, with the same
  instruction.
- **The customer's reply, on the screen:** "✅ Updated one entry in loaves."
- **The job's stored reply:** `ok`, layer `data`, and `applied` exactly
  `[{table: "loaves", id: 6, columns: ["price"]}]`, with no files, no reorder
  and nothing failed.
- **The database change, on both readers:** row 6's price from 4.5 to 4.6,
  and nothing else.
- **The order page:** the focaccia's card at £4.60, and every other card as it
  was.
- **Nothing published:** no version in the chain, the job row's publish fields
  empty, and every route still on the before-read's version.
- **The money:** the balance moves by exactly the routing charge plus the
  job's own cost. The job is `finalized` with ledger debits equal to its cost
  and no refund (or `exempt` with no ledger row).
- **The condition probe:** the Worker answered the write no row can meet with
  409 conflict (or 404 for a row that is gone), and nothing changed.
- **The recovery:** the conditional write answered 200, said its condition
  held (`conditional: true`), and changed that one field alone; there was no
  conflict; the target row equals its baseline on both readers, and the
  visitor body byte for byte; the order page is back to every line it had.

**The recovery alone: `4b-d1-restore`.** For a run that could not finish its
recovery. It opens no app and sends no message. It reads the row; with spend
`yes` it writes the price back to 4.5 only if it reads 4.6 (in the type the
owner route reads it as), with the same condition as the automatic recovery,
and with spend `no` it only says what it would write. It compares the visitor
read with the proposal's record and reports any difference without writing
it. It asks the condition probe first too, and never sends its write to a
Worker that cannot enforce the condition.

**Evidence, none of it live:**
- `test/canary-rows.test.mjs` (17 cases, new): the decisions. They cover the
  price as a decimal ("4.60" is 4.6), the row lists, the fresh baseline, the
  change, the recovery's plan, the write's own answer, the restore verdict,
  both recovery paths over a supplied table (a concurrent 4.7 refused, another
  row's change kept), and the page's lines.
- `test/canary-ui.test.mjs` (22 → 37 cases): the scenario's facts, the wall,
  and the request, reply, money and nothing-published checks. Then the whole
  run through the driver, with a stand-in page and a supplied database:
  - the paid path: the page and both readers read with nothing between them
    and Send, then exactly one PATCH, `{price: "4.5"}`, after the Send;
  - the rehearsal, each baseline refusal, a concurrent change refused, another
    row's change kept, and a reply that never came;
  - the recovery scenario: a dry run, a write, nothing to do, a refusal, and
    the visitor tab's GET-only wall.
- **Probes** (`scripts/mutants/canary-rows.json`): 52 mutants, 52 killed, 0
  never applied, 3 comment-only controls surviving. They ran over the four
  changed files against seven test files, and the files were byte-identical
  afterwards. The first run left two survivors: `changeVerdict` ignoring the
  value a change started from, and `restored` asking the owner route alone.
  Both were fixtures too shallow to tell the readings apart, and one assertion
  each killed them.
- **The full suite, locally:** 8,073 tests, 8,071 pass, 0 fail, 2 skipped;
  +32, exactly the new cases.
- **Unit CI** (run 36290449793 on `6602be37`): 8,073 / 8,069 / 0 / 4 skipped.
  The total matches, and `pass` differs by CI's four skips. All 54 cases of
  the two files pass by name, with 8,073 distinct result numbers, no gap and
  no `not ok`. No site build fires, since none of the files is on its paths.
- **A local proof in a real Chromium** (scratch, not committed): the live
  app's code and the live order page's code, fetched with GET only, with every
  API answer and the `loaves` table supplied in memory. Six modes: paid,
  rehearsal, a misroute, a hang, a recovery dry run and a recovery write. Each
  behaved as described above, and no request but a GET left for the network.

**Not established until a live run** (written before the press): which layer
the router picks for this sentence, the data rung's real answer, and the live
database. Run 42 established all three, for this sentence on this site
(below).

**The free rehearsal ran as run 40 and passed** (`36291812275`, 2026-09-27
03:34:40 → 03:36:03Z; the owner's press from the branch at `95eb36da`; canary
step 38 s):
- **The env block:** spend 0, scenario `4b-d1-price`, site fold-lane-bakery,
  control washhouse-3; the instruction, job and version boxes blank; both
  expectations set.
- **The preflight:** build-health and runtime both answered `ab74d0d94384`
  with image `369d7b1e5bae25b0`; async and runner true; both readers agreeing.
  The zero-cost confirmations passed. Their two jobs are `failed`, billing
  `none`, cost 0, and published nothing.
- **The before-read:** complete (`reads` all true), every route on
  `01790468089054-8btpep` (run 39's last publish), and all five page bodies
  byte-identical to run 39's after-read, with no U+FFFD.
- **The app:** signed in as the building account, and the site's card opened.
  The message was typed and not sent (`ui-step-1-rehearsal.png`). The page
  made three GETs (the site list, the credits and the page list) and nothing
  else: 0 blocked, 0 console errors, 0 page errors.
- **The order page**, at `8btpep` in its GET-only tab, showed six cards,
  including "Sea Salt Focaccia £4.50 · A tray bake, heavy on the oil, finished
  with flaky salt."
- **The fresh baseline at 03:35:57.388Z:** six rows on both readers, and row 6,
  "Sea Salt Focaccia", at 4.5 on both.
  - **The owner route reads the price as a JSON number**, so the recovery will
    write the number 4.5 back. The unit cases drove the string form too.
  - The visitor read (1,045 bytes, sha256 `ef870ebcf8353634`) equals the
    proposal's six-row record.
- **The recovery's plan at the baseline:** none (`at-baseline`). The balance
  read 59 → 59.
- **Checked again by the session afterwards** (03:42Z, read-only):
  - the visitor route answers the same 1,045 bytes, sha256
    `ef870ebcf8353634`, with the focaccia at 4.5;
  - `/` and `/order` answer `01790468089054-8btpep`;
  - `edit_jobs` since 03:00Z holds only the two confirmation jobs;
  - `credit_events` has no row after run 39's reserve at 00:12:09Z;
  - the balance row reads 59.
- **So the paid press starts from an established before-state.** It is the same
  form with spend `yes`.

**The recovery's write is conditional (2026-09-27; closed by the owner after
review, and merged and deployed in deploy 2163).** The owner, after run 40: *"restoreRow/recoverRow read the price,
then call an unconditional owner PATCH. site-owner.mjs updates WHERE id=?
only. Reproduced locally: Recovery reads 4.6. Another writer changes the price
to 5.2 before PATCH executes. Recovery overwrites it with 4.5 and reports
restored. Make the recovery's expected-value check and write atomic … A
conflict must change nothing and be reported explicitly. Another pre-read does
not close this gap."*
- **Reproduced first**, through the real route, in both recoveries. A second
  writer set 5.2 after the recovery's read; the plain PATCH wrote 4.5 over it,
  and the account said RESTORED. On a real PostgreSQL 16 the plain statement
  did the same when the other write had committed first, and also when the
  other write held the row while the recovery's UPDATE waited.
- **The fix is in the owner rows route** (`site-owner.mjs`, which is Worker
  code). A PATCH body `{"$set": {…}, "$if": {…}}` becomes ONE statement:
  `UPDATE … SET … WHERE id=? AND "col" IS NOT DISTINCT FROM ? … RETURNING *`.
  Postgres judges the condition against the row as it stands when the write
  runs, so there is no window between a check and a write for another write to
  land in. The answers:
  - the row matched: 200, the row, and `conditional: true`;
  - the row no longer matched: nothing written, 409 `code: "conflict"`, with
    the row as read afterwards (that read decides nothing);
  - the row is gone: 404;
  - a malformed form: 400 `bad_condition`, before any statement. That covers
    an extra key, a condition on a column the table lacks, a `$set` key the
    route would drop, a value that is not a string, number, boolean or null,
    and an empty condition.
  - The plain PATCH is unchanged.
- **A Worker from before the form can refuse it, and can never make it
  unconditionally.** `$` never begins a column name, so such a Worker finds
  nothing it can write in the body and answers 400 "nothing to update" before
  any statement. This was measured by running the unfixed route itself
  (`HEAD`'s `site-owner.mjs`) on the recovery's body and the probe's: 400 and
  no statement, both times. A plain body, as a control, wrote.
- **The values go untyped, as the Neon driver sends them**, so Postgres casts
  each to its column's type: `'4.6'` matches a REAL 4.6 and a NUMERIC 4.60. A
  float8-typed 4.6 never matches a REAL 4.6 (measured).
- **The canary.** Both recoveries send `{"$set": {"price": <the baseline>},
  "$if": {"name": "Sea Salt Focaccia", "price": <the value just read>}}`.
  - A 409 is a CONFLICT: it gets its own line in the account, the check "no
    other write changed the row between the recovery's read and its write"
    fails, the final state reads NOT RESTORED, and nothing is retried.
  - A 200 without `conditional: true` is not taken as the recovery's write.
  - RESTORED is said only after a write that landed. A row back at its
    baseline because somebody else wrote it reads "AT BASELINE, but NOT by
    this recovery".
- **The probe, before anything changes.** It sends the write no row can meet
  (the row's own id and the id 0 at once). A Worker with the form answers 409
  (or 404 for a row that is gone) and changes nothing; one without it answers
  400.
  - The paid run is not sent unless the probe answered 409 or 404 (a
    "condition" stop).
  - `4b-d1-restore` never sends its write then.
  - The rehearsal reports the answer, and its check fails.
  - The probe is a write REQUEST to the live owner route that matches no row.
    On a real PostgreSQL the table's hash and the row's `xmin` are unchanged
    after it. The engine creates only row-level triggers, so an UPDATE of no
    rows fires none.
- **On a real PostgreSQL 16** (`test/integration/local-pg-owner-cas.mjs`, run
  by hand, not in CI). It uses the statement the real route builds, with
  placeholders converted by the real `toPgPlaceholders`/`pgParams` and the
  parameters sent untyped through psql's `\bind`, on REAL and NUMERIC
  columns. The control lands. A 5.2 committed before the write: UPDATE 0, and
  5.2 kept. Another transaction holding the row and committing 5.2 while the
  conditional write waits on its lock: UPDATE 0, and 5.2 kept. The plain
  statement overwrites in both cases. A concurrent change to another field:
  the price is written and the other field kept. A renamed row: nothing
  written. The probe: UPDATE 0, nothing changed.
  - **17 of 17 pass** on the final files. The conditional write waited
    1,491–1,504 ms on the other transaction's lock, then matched nothing.
- **Tests** (every competing write lands immediately before the owner route's
  UPDATE runs, through the real route over an in-memory table,
  `test/fixtures/owner-table.mjs`, new):
  - `test/site-owner.test.mjs`, 63 → 70 cases: one statement carrying every
    condition, conflict, gone, null and `id` conditions, the declared column
    name, every malformed form refused before any statement, and the plain
    PATCH unchanged.
  - `test/canary-rows.test.mjs`, 17 → 27: both recoveries against a
    competing write on NUMERIC and REAL columns, a row renamed or deleted, a
    competing write that puts the value back first, a change to another
    field, a Worker from before the form, a 200 that does not say its
    condition held, and the probe.
  - `test/canary-ui.test.mjs`, 37 → 41: the paid run's recovery and the
    standalone recovery with a competing write, a Worker without the form
    (the paid run sends nothing, the recovery writes nothing, the rehearsal
    reports it), and a probe whose transport throws.
- **Red on the unfixed product** (a worktree of `3e0c8d7e`, with only the new
  test files and fixture copied in, and the probe's two helpers appended so
  they load): **33 cases fail**, 6 of 70 in `site-owner`, 16 of 27 in
  `canary-rows` and 11 of 41 in `canary-ui`. Every race case fails on the
  overwritten value, "4.5 !== 5.2". The two UI race cases fail first on the
  request's shape; with that assertion cut, they fail on the overwritten
  value too.
- **Probes** (`scripts/mutants/owner-cas.json`): 37 mutants, 37 killed, 0
  survived, 0 never applied, 3 comment-only controls surviving. They ran over
  the four changed files against 13 test files, and the files were
  byte-identical afterwards.
  - The first run left one survivor. C-6 skipped an unknown column in the
    condition instead of refusing it. Alone, such a column also leaves no
    condition, so it was refused anyway; one case now puts it beside a known
    column, where skipping it would write on less than was asked.
  - D1's own spec (`scripts/mutants/canary-rows.json`, three mutants
    re-anchored to the new lines) re-ran over the final files: 52 of 52
    killed, 3 controls surviving.
- **The full suite, locally:** 8,094 tests, 8,092 pass, 0 fail, 2 skipped;
  +21 against 8,073, exactly the new cases.
- **Unit CI** (run 36294546760 on `5c000598`): 8,094 / 8,090 / 0 / 4 skipped
  (`duration_ms` 127,100). The total matches, and `pass` differs by CI's four
  skips. All 138 cases of the three changed files pass by name, with 8,094
  distinct result numbers, no gap and no `not ok`.
- **`site build`** (run 36294546743 on `5c000598`, 04:31:19 → 04:57:03Z,
  25m44s; all twenty steps green): TAP 397/397/0/0, kit-typecheck 4,
  site-build 404, contrast-cases 16, theme-seam 11, theme-render 29,
  site-routing 14, site-runtime 47, and kit-render / kit-a11y / kit-effects /
  kit-paint all passed; census 7 + 4 + 1 = 12. The only `##[error]` lines are
  the two known annotations. `site-build.mjs` took 18m43s.

**The order, because the fix is Worker code.** The paid press could not run
on deploy 2162: its route had no conditional write, so the probe answered 400
and the paid run stopped before Send. What it needed, in order:
1. **The owner's approval to merge and deploy — given and done (2026-09-27).**
   The owner closed the correction after review (165 focused tests, the
   product commit's unit CI and site build green): *"Once the current tip's CI
   passes, merge and deploy the reviewed changes, preserving any newer main
   commits."*
   - **Checked before the push:** unit CI on the tip `14df0225` (run
     36295887583) read 8,094 / 8,090 / 0 / 4; no workflow run in progress,
     queued, waiting or requested; no edit job in a live state; main unmoved
     at `ab74d0d9` and an ancestor of the tip, so nothing newer on main could
     be lost.
   - **Predicted, and re-read over the merged tree:** main (`ab74d0d9`)
     answered `369d7b1e5bae25b0`, the image runs 35 and 40 read live; the tip
     `14df0225` answered **`9038e90ab1d5d7fe`**, from 188 inputs and 158
     distinct paths, `site-owner.mjs` the only input among the 21 files.
   - **A rollback is clean:** reverting `ab74d0d9..14df0225` (17 commits) in a
     throwaway worktree gives tree `61271c36…`, main's own, so a rollback
     reuses `369d7b1e5bae25b0`.
   - **A fast-forward:** main `ab74d0d9` → **`14df0225`** at 05:11:56Z.
   - **Deploy 2163 ([run 36296506076](https://github.com/canias7/isibi-app/actions/runs/36296506076)),
     success, 05:12:02 → 05:15:03Z**, read off its own log: `DEPLOY_ID`
     `14df0225be90…` (masked in the log as `***4df0225be90e…`); the gate took
     over from `ab74d0d9…`; the image **built `9038e90ab1d5d7fe`** (the
     registry answered 404, 188 inputs, 0 cached layers, 2m10s) and **rolled
     from `369d7b1e5bae25b0`** under `SUCCESS Modified application`; the drain
     found no live leases; `No updated asset files to upload`, so there is no
     served-file check; a fresh Worker version. Gates 401 / 401 / 401 / 404 at
     05:15:42Z.
   - **Runtime-confirmed by the rehearsal, run 41** (below). The log above is
     the deploy reporting on itself; run 41's preflight read the live Worker's
     own sha (`14df0225be90`) and a cold container's image
     (`9038e90ab1d5d7fe`), both readers agreeing.
   - **The hold:** the image rolled at 05:15Z, so the rehearsal waited until
     05:31Z. The session's one dispatch attempt then (05:31:35Z, from `main`,
     spend `no`, both expectations set) answered **403 Resource not
     accessible by integration**, so the rehearsal was the owner's press. It
     was not retried.
2. **A fresh free rehearsal with the new identifiers — done: run 41 passed**
   (below). It made one PATCH that changes nothing, the probe, and the new
   route answered 409.
3. **The paid press**, the same form with spend `yes` — **done: run 42
   passed** (below).

**Ready-to-run inputs.** [`edit canary`](https://github.com/canias7/isibi-app/actions/workflows/edit-canary.yml)
→ Run workflow → **branch `main`**. Since the merge, main carries the UI mode
and both D1 scenarios, so the script, the Worker and the image it checks are
all main's. The boxes, by their descriptions:

| Box | Rehearsal (free) | The paid press |
| --- | --- | --- |
| Run the ONE paid edit as well (yes/no) | `no` | `yes` |
| What to change. REQUIRED when spend=1… | blank | blank |
| READ ONE EXISTING JOB AND STOP… | blank | blank |
| PUT ONE SAVED VERSION BACK… | blank | blank |
| RUN A NAMED SCENARIO IN A REAL BROWSER… | `4b-d1-price` | `4b-d1-price` |
| The site to edit… (defaults to `fretwork-1`) | **`fold-lane-bakery`** | **`fold-lane-bakery`** |
| A second site… | leave `washhouse-3` | leave `washhouse-3` |
| Refuse to spend unless the Worker reports this deploy sha… | **`14df0225be90e2637764ea33771d64f4a393b628`** | the same |
| Refuse to spend unless a cold container reports this image id… | **`9038e90ab1d5d7fe`** | the same |

- **The rehearsal** signs in, opens the card, types the message, asks the
  probe, reads the order page and the baseline, prints the recovery's plan at
  the baseline ("none"), and stops before Send. It changes nothing and spends
  nothing. **Its one write request is the probe**, which matches no row.
- **What the rehearsal must show:**
  - the preflight reads `14df0225be90` and `9038e90ab1d5d7fe` on both readers;
  - `condition  the Worker writes only while the row still matches: a
    conditional write no row can meet answered 409 and changed nothing`;
  - the baseline, read AFTER the probe: row 6, "Sea Salt Focaccia", 4.5 on
    both readers, and the visitor read byte-identical to the record (1,045
    bytes, sha256 `ef870ebcf8353634`);
  - the order page shows the focaccia at £4.50;
  - the recovery's plan at the baseline is "none";
  - the balance does not move.
- **The paid press** is the same form with spend `yes`.
- **If the paid run ends without its recovery**, press `4b-d1-restore` with the
  same boxes: first with spend `no`, to see what it would write, then with
  spend `yes`. It asks the probe too.
- **A conflict is not retried.** If another write lands between the
  recovery's read and its write, the run says CONFLICT, fails, and leaves the
  row as that write left it. Pressing `4b-d1-restore` then reads the row again
  and writes only if it reads 4.6.

**The fresh rehearsal ran as run 41 and passed** ([`36297687383`](https://github.com/canias7/isibi-app/actions/runs/36297687383),
2026-09-27 05:36:23 → 05:37:44Z; the owner's press from `main` at `14df0225`;
canary step 38 s):
- **The env block:** spend 0, scenario `4b-d1-price`, site fold-lane-bakery,
  control washhouse-3; the instruction, job and version boxes blank; both
  expectations set.
- **The preflight, deploy 2163's runtime confirmation:** build-health and
  runtime both answered `14df0225be90` with image `9038e90ab1d5d7fe`; async and
  runner true; both readers agreeing; both expectations matched. The zero-cost
  confirmations passed (both sites got the async shape, a forged replay and a
  stranger's poll answered 404, and the free job settled in ~8 s at cost 0).
  Their two jobs are `failed`, billing `none`, cost 0, and published nothing.
- **The before-read:** complete (`reads` all true), every route on
  `01790468089054-8btpep`, and all five page bodies byte-identical to run 40's
  before-read, with the same path set and no components. The control: against
  run 39's BEFORE-read the same comparison differs on every page.
- **The app:** signed in as the building account, the site's card opened, and
  the message typed and not sent (`ui-step-1-rehearsal.png` shows it in the
  composer over an empty thread). The page made three GETs (the credits, the
  site list, the page list) and nothing else: 0 blocked, 0 console errors,
  0 page errors.
- **The probe:** `capability: enforced`, status **409**. It runs first: the
  code's order is the probe, then the order page, then both readers
  (`scripts/canary-ui.mjs`), so everything below was read after it.
- **The order page** (05:37:28Z, at `8btpep`, in its GET-only tab): six cards,
  including "Sea Salt Focaccia £4.50 · A tray bake, heavy on the oil, finished
  with flaky salt."
- **The fresh baseline at 05:37:39.318Z:** six rows on both readers, the two
  lists equal, and row 6, "Sea Salt Focaccia", at 4.5 on both (a JSON number on
  the owner route). The visitor read is 1,045 bytes, sha256
  `ef870ebcf8353634`, byte-identical to run 40's and equal to the proposal's
  record.
- **The recovery's plan at the baseline:** none (`at-baseline`). The balance
  read 59 → 59.
- **Checked by the session afterwards** (05:46–05:48Z, read-only):
  - the visitor route answers the same 1,045 bytes, byte-identical to the
    05:16Z read and to run 40's, with the focaccia at 4.5;
  - `/` and `/order` answer `01790468089054-8btpep`;
  - a real Chromium, GET only, reads the same six cards on `/order`, the
    focaccia at £4.50, with no page errors;
  - the balance row reads 59 (05:48:40Z), `credit_events` has no row after
    run 39's reserve at 00:12:09Z, and `edit_jobs` since 05:30Z holds only the
    two confirmation jobs.
- **So the paid press starts from an established before-state on the deployed
  code.** It is the same form with spend `yes`, and it is the owner's call.

**The paid press ran as run 42 and passed** ([`36298962234`](https://github.com/canias7/isibi-app/actions/runs/36298962234),
2026-09-27 06:03:09 → 06:05:06Z; the owner's press from `main` at `14df0225`;
canary step 77 s). Everything below is read off the run's log and its
evidence artifact, then checked again by the session, read-only.
- **The env block:** spend 1, scenario `4b-d1-price`, site fold-lane-bakery,
  control washhouse-3; the instruction, job and version boxes blank; both
  expectations set.
- **The preflight:** build-health and runtime both answered `14df0225be90`
  with image `9038e90ab1d5d7fe`; async and runner true; both readers agreeing;
  both expectations matched. The zero-cost confirmations passed. Their two
  jobs are `failed`, billing `none`, cost 0, and published nothing.
- **The before-read:** complete (`reads` all true), every route on
  `01790468089054-8btpep`, and all five page bodies byte-identical to run 41's
  before-read. The control: against run 39's BEFORE-read the same comparison
  differs on every page.
- **Before Send**, in the code's order:
  - **The probe** answered **409** (`enforced`).
  - **The order page** (06:04:04Z, at `8btpep`) showed the focaccia at £4.50.
  - **The fresh baseline** (06:04:11.393Z): six rows on both readers, and row
    6 at 4.5 on both. The visitor read is 1,045 bytes, sha256
    `ef870ebcf8353634`, equal to the proposal's record. The recovery's plan
    at the baseline: none.
  - **The balance** read 59, so the budget check let the message go.
- **The request:**
  - The message left word for word.
  - The routing call answered `intent=edit layer=data`, cost 2 (`6,774 in /
    15 out`, 512 cached). It was sent the site's five pages and `tables: []`,
    which is what a browser sends for a site it adopted off the list, so the
    router picked `data` with no table names to go on.
  - Then exactly **one** edit POST, 202, at the `data` layer, with the same
    instruction: job `dfb7ca810fa2469395917b315c5db71f`.
  - Nothing else was started: 0 blocked, 0 console errors, 0 page errors.
- **The reply**, 36 s after Send: "✅ Updated one entry in loaves." (the
  scenario's expected sentence). The composer came back usable: not busy,
  Send live, no Stop button, no "Working" row, and the box took typing.
- **The stored reply** (200 under `x-gf-edit: final`):
  - `ok`, layer `data`, cost 1 (`1,370 in / 37 out`, 512 cached, one call);
  - `applied` exactly `[{table: "loaves", id: 6, columns: ["price"]}]`, and
    `failed: 0`.
- **The job row:**
  - `done`, billing `finalized`, cost 1;
  - created 06:04:24.140Z and settled 06:04:40.986Z;
  - `publish_started_at` and `published_at` empty.
  - The trace candidate ended 06:04:40.527Z after 11,769 ms, ok.
- **The database change, on both readers** (06:04:50.360Z): row 6's price
  4.5 → 4.6, and nothing else. No other field or row changed, and no row was
  added or removed. The visitor body is still 1,045 bytes and differs from
  the baseline in exactly one character, the `5` of `"price":4.5` (sha256
  `f939ed91502d913f`).
- **The order page after the edit** (06:04:50Z, at `8btpep`): the focaccia at
  **£4.60**, and the other five cards as they were.
- **The recovery**, with no model call:
  - It read both readers again at 06:04:52.968Z (4.6) and planned a patch
    (`reads-what-this-test-set`).
  - `PATCH /rows/loaves/6 {"$set":{"price":4.5},"$if":{"name":"Sea Salt
    Focaccia","price":4.6}}` answered **200**, with the route's `conditional:
    true` (the canary refuses a 200 without it) and the row back at 4.5.
  - There was no conflict.
  - **This is the first live conditional write that matched.** Run 41 showed
    the other side: a write no row can meet answered 409.
- **Restored** (06:04:53.484Z):
  - the row equals its baseline field for field on both readers;
  - the visitor body is byte-identical to the baseline (`ef870ebcf8353634`);
  - the order page is back to every line it had, the focaccia at £4.50.

  So the site showed £4.60 for seconds, not minutes: from the job's write
  (inside 06:04:24–06:04:41Z) to the put-back at 06:04:53Z.
- **Nothing published:**
  - no version names the job, and the job row's publish fields are empty;
  - the after-read (06:04:58Z) found every route still on `8btpep`, and the
    chain reads VERIFIED;
  - the five route pages are identical to the before-read once render times
    are masked (the control: a one-word change is seen);
  - the stored bodies are identical.
- **The money closes exactly: 59 → 56 = routing 2 + edit 1**, at the top of
  the 2–3 estimate. `credit_events` holds one row for the job, `reserve −1`,
  `balance_after 56`, ref `<job>#1`, at 06:04:40.179Z, and no refund. The
  routing charge writes no ledger row. The reserve's `after 56` puts the
  balance at 57 just before it.
- **Checked by the session afterwards** (06:13–06:17Z, read-only):
  - the balance row reads 56 (06:13:03Z);
  - `credit_events` since midnight holds only run 39's reserve and run 42's;
  - `edit_jobs` since 05:50Z holds only the two confirmation jobs and run
    42's job;
  - the visitor route answers 1,045 bytes, byte-identical to run 41's
    reading, with the focaccia at 4.5 (06:16:34Z);
  - all five routes answer 200 on `8btpep`;
  - a real Chromium, GET only, reads the same six cards on `/order` as after
    run 41, with the focaccia at £4.50, no page errors and no request but a
    GET (06:16:55Z).
- **What it established, for this sentence on this site:**
  - the router picks `data`;
  - the data rung changes exactly the one field on the live database, and its
    `applied` report matches the database;
  - the order page reads the new value at once, with no publish;
  - the reply and the composer behave;
  - the recovery's conditional write lands and puts the one field back.
- **What it did not establish:**
  - adding, removing or reordering rows;
  - a data edit on an `incomplete` site;
  - the rules rung;
  - the router's handling of any other wording.

**Cost, estimated before the press:** about 2–3 credits. That is the routing charge (1–2; run 39's three
routing calls cost 2, 1 and 2) plus the data rung's one call, rounded once
with a floor of 1. **That figure is an estimate, not a cap.** The scenario's
budget of 5 is checked only before a message is sent: `budgetRefusal` refuses
to send when the spend since the run began is already 5 or more, or when the
balance cannot be read. D1 sends one message, so the check cannot stop
anything, and it never caps what that one request costs. Nothing on the server
caps it either (`edit_reserve` refuses only above 100,000), so the balance is
the only bound. The rehearsal, the recovery and
`4b-d1-restore` are free. The balance was 59 before run 42 (read by run 41 at
05:37:23Z, on the balance row at 05:48:40Z, and by run 42 at 06:04:00Z).
**Measured on run 42: 3 credits**, routing 2 and the data rung's 1, at the
top of the estimate. The balance is now **56** (read by run 42 and on the
balance row at 06:13:03Z; the last ledger row is run 42's reserve at
06:04:40Z).

**D2 and D3 — parked (owner, 2026-09-27).** Kept prepared, not scheduled:
- **D2** is `grants preview` in `apply` mode on fold-lane-bakery, undone by its
  `rollback` mode with step 0's run ID (36286991932), within the artifact's 90
  days (until 2026-12-26). It is maintenance: it moves the site's grants to
  the column-scoped form every site now gets. What it would issue, and its
  rollback, are in step 0's record above.
  - A green run is not its check. A refused statement is logged as `REFUSED`
    and the verify after it as `FAIL`, but nothing sets an exit code, so the
    lines are the check.
  - The rollback box's description says "the run number", but it needs the run
    ID (36286991932, not 1).
  - After a correct rollback, `verify` reads `FAIL`, so the check is another
    `preview`, whose lines and recorded grants must equal step 0's.
- **D3** is one real order under those grants, from a real browser session.
  It is an integration check of the order form.
- **Neither exercises the rules rung, and neither closes rules-edit
  coverage.**
- **The rows scenario the proposal named `4b-rows-back` is not built.** D1's
  own recovery and `4b-d1-restore` do its row half, bounded to the one field
  D1 changes; its order-deletion half belonged to D3.

**Found on the way, not changed:**
- The Data panel's Save turns an empty (NULL) field into an empty string,
  because it sends every field as text. D1's recovery writes only the changed
  field for that reason.
- The API canary treats any successful edit reply as a publish, so for a data
  edit its page comparison would read `not-listed`. D1 runs through the UI
  mode, whose chain handles an edit that publishes nothing.
- ~~The owner rows route has no conditional write.~~ It has one now, deployed
  in 2163: *the recovery's write is conditional*, above.
- **The data rung's reply names the table, not what changed** (run 42). The
  customer asked for "the Sea Salt Focaccia's price" in "today's bake list";
  the screen said "✅ Updated one entry in loaves." The composer builds the
  sentence from `applied`, which carries only the table, the row id and the
  column names, so it cannot say which loaf or the new price. The sentence is
  true. This is recorded for the model-written replies preference and not
  changed. **The owner kept it there when closing D1, not reopened.**

**What Test 4 does not cover:** hydration, translation, model-written replies,
the add-on, a css-lane run, a page removal (the move exercises the same verb
and publish path), a hop between rungs, why a quick attempt did not publish,
and the rules rung (the recommended next test, next).

### The rules rung — the recommended next test (2026-09-27; not approved, nothing built)

Owner, first: *"Prepare a separate rules-test proposal using an isolated fixture
or complete deterministic recovery."* Then: *"For the rules test, compare the
smallest isolated fixture against your proposed database restore approach.
First check whether an existing disposable fixture can avoid buying another
build. Do not implement a whole-database restore or run it against an active
site yet."*

**Why it needs its own test.** A rules edit ends in one `applySiteSchema` over
the whole merged spec. Besides the rule asked for, that apply:
- rewrites the stored schema (`_meta`);
- drops and re-creates every table's policies;
- re-creates the helper and trigger functions;
- re-issues every table's grants.

On a site built before 2026-09-13, it also carries every engine change since.
Five rules cannot be taken off through an edit: `unique`, `uniqueci`,
`noOverlap`, `oncePerUser` and `maxRows`.

**The apply runs its statements one at a time and logs a failed one rather
than stopping.** So a "✅" in the reply does not prove the rule took effect;
reading the grants afterwards does.

**The three ways, compared**

| | The existing throwaway site `lido-axes-b` | A new throwaway site | Rewinding fold-lane-bakery's database (Neon's point-in-time restore) |
| --- | --- | --- | --- |
| Build credits | 0 | about 27–62 (a page build of 11–45, then an add-on that designs a table, about 12–13) | 0 |
| The rules message | about 3 | about 3 | about 3–4 |
| New tooling | a scenario, and a no-publish check for the older page layout | a scenario | a restore tool, and a rehearsal on a throwaway Neon project |
| Touches a site anyone uses | no | no | yes: it rewinds a live site's whole database |
| Recovery | none needed | the product's own delete | the restore, itself undoable through Neon's backup branch |
| An older site's first schema change | yes, except the write grants | no: a new site starts on today's grants | yes, then undone |

**No new build is needed: an existing site will do.** These are read-only
checks from 2026-09-27.
- **`lido-axes-b` is the owner's and has never been edited.**
  - It was built on 2026-08-22 by the `build as owner` evaluation (arm B),
    which its own workflow calls "spent". The same workflow keeps arms A and B
    because a stylesheet comparison rests on them. A rules edit publishes
    nothing and leaves the stylesheet and pages alone, so that comparison is
    unaffected.
  - It has its own Neon project, created after 2026-07-29, when each site got
    one.
  - Its database reference is present (`ready`).
  - It has no edit jobs and no other addresses.
  - Nothing in the repository's tests or tools reads it.
- **It has the shape the test needs**, read as a visitor (06:52Z):
  - three pages (`/`, `/menu`, `/book`), each answering 200;
  - a public `menu_items` table. The page's own read
    (`?select=*&order=name.asc`) returns 6 rows, 1,208 bytes, sha256
    `8e1d493cd891abc8`;
  - a `bookings` table a visitor cannot read (403 with Postgres's
    `42501`). The `/book` form writes it with a name, a phone, a party size, a
    date and a time.

  So it mirrors fold-lane-bakery's `loaves` and `orders`. The stored access
  rules are inferred from this, not read; the first `grants preview` press
  below reads them.
- **It uses the older page layout.** It last published before 2026-09-05, when
  every publish became a saved version. So its pages send `x-site-build`
  (`mt50cg7h-l19hre`) and no `x-site-version`. A rules edit publishes nothing,
  so that stays true, but the canary's no-publish check needs a version and has
  to learn the older header.
- **The other candidates, rejected**:
  - `lido-free-a`: its `/book` page does not load;
  - the other lido copies: they answer 404;
  - `pierhead-lido` and `the-lido-cafe`: scripts and tests read them;
  - `repairbench-1`: it is the add-on bench, with scheduled jobs of its own.
- **A free new fixture cannot work.** A schema-only build (`{schema, slug}` and
  no brief, as `member-smoke` uses) gets a database for no model spend. But it
  publishes only a placeholder with no stored pages, so the app has no page
  list to route with and stops before sending, and the API canary refuses too.

**Recommended: one rules message on `lido-axes-b`.** The exact scope:
- **The message**, sent by a named UI-mode scenario, never as form text: "We're
  fully booked, so stop taking bookings on the website for now." It is 67
  characters, all ASCII, sha256 `3ccbae0b202aa2e2…`.
  - "stop taking bookings" and "we're fully booked" are the rules tool's own
    examples for closing a table.
  - "close the booking form" is the router's example for the rules layer.
- **What is expected**:
  - one routing call answering `intent=edit layer=rules`;
  - one job, with one quick-model call (`write_table_rules`) that sets
    `bookings.retired` and nothing else;
  - the ledger reserving before any schema change, and nothing published;
  - the rung's reply "✅ **bookings** — changed whether it's open.", to which
    the browser's composer adds "It’s live now — nothing needed rebuilding."
    (composed locally). The exact screen text is taken when the scenario is
    built. It says what kind of thing changed, not that bookings are closed:
    the same generic wording as D1's, kept for model-written replies.
  - The wall lets only a `rules` edit leave the page, so a misroute costs the
    routing charge and changes nothing.
- **What changes**, all of it in `lido-axes-b`'s own database:
  - `bookings` closes to visitors. Both visitor roles lose every privilege and
    its row policies are dropped. Its rows stay.
  - `_meta.schema` is rewritten, marking `bookings` as retired.
  - `menu_items`' policies and read grants are dropped and re-issued, with the
    same effect as before.
  - The helper and trigger functions are re-created with today's pinned
    `search_path`, and `_secrets` and `_errors` are created if they are
    absent. This is the older site's first schema change.
- **What a visitor sees**: every page as before, and the menu as before. The
  `/book` form still shows, but a booking is refused from then on.
- **The checks**, in four presses. All four are the owner's, because a
  session's dispatch answers 403.
  1. **`grants preview`** (free), mode preview, site `lido-axes-b`. This is the
     before-state: `_meta.schema` present, `bookings` INSERT for both visitor
     roles, and `menu_items` SELECT for both.
  2. **The canary's UI mode from the branch**, with the new scenario and spend
     no (free):
     - the preflight;
     - the before-read, which also shows that the stored pages read back (the
       app needs them to send);
     - the app opening the site and typing without sending.
  3. **The same with spend yes** (the paid press). It checks:
     - the message, the job, and the ledger, with the money closing exactly;
     - that nothing published: the same stored source, the same `x-site-build`
       on every route, the pages the same once render times are masked, no
       version naming the job, and no publish on the job's row;
     - that a visitor's menu read is byte-identical, and a visitor is still
       refused `bookings`.
  4. **`grants preview` again** (free):
     - `bookings` holds nothing for either visitor role;
     - its planned statements are the two REVOKEs a retired table gets;
     - `menu_items` is unchanged.
- **Cost**: about 3 credits. Routing is 1–2, and the rules call is about 1: its
  prompt measures about 6,700 characters, about 2,200 tokens. That is D1's
  shape. It is an estimate, not a cap: the balance is the only bound, and it
  is 56.
- **Side effects**: only `lido-axes-b`'s database and the job and ledger
  records. There is no publish and no container build, and no other site is
  touched.
  - If the apply fails part way, some statements may have run while the reply
    says the change could not be saved. The fourth press shows exactly what
    landed.
- **Recovery**: none is needed. The recommended end state is `bookings` left
  closed on a spent fixture. Two options, both the owner's call:
  - reopen it with a second rules message ("start taking bookings again"),
    about 3 credits and a model call;
  - delete the site with the product's own delete, which is not reversible.

  No restore is involved.
- **Stop conditions**:
  - the first press finds no `_meta.schema`, or tables other than the two
    expected;
  - the free rehearsal finds that the stored pages do not read back.

  Either means `lido-axes-b` cannot serve, and the choice goes back to a new
  throwaway site or the restore.
- **What it will not show**:
  - a real booking being refused (the grants are read instead, and no visitor
    write is attempted);
  - column-scoped write grants;
  - a rule that cannot be taken off;
  - any restore.
- **To build before any press** (not built; it waits for the owner's
  go-ahead):
  - the scenario, with `layers: ["rules"]`, `publishes: 0`, the expected reply
    and a rules-shaped check of the stored reply;
  - the no-publish check for the older layout;
  - the visitor-read checks;
  - as for D1: focused tests, a red check, targeted probes, the suite and CI.

  It lives in `scripts/`, which a merge does not deploy, so it is dispatched
  from the branch, as runs 36–40 were.

**The restore stays a later option, not built.** Neon restores a root branch to
its own past: `POST /projects/{id}/branches/{branch}/restore`, with an LSN or a
timestamp and `preserve_under_name`. It replaces all data and schema on the
branch and keeps the old state as a backup branch. Before it could be used:
- a tool that refuses unless all of these hold:
  - the project holds only that site's database;
  - the branch is a root branch;
  - the point is inside retention;
  - nothing but the test's own change has happened since;
- a rehearsal on a throwaway Neon project first.

It is the way to test a rules change on a site people use. The owner has said
not to build it or run it against an active site yet. The earlier plan (R0–R2
on fold-lane-bakery) is in git: `git show
4d385201:docs/investigations/edit-path-checklist.md`.

## A section headed by the kit — fixed (2026-09-26), merged and deployed in deploy 2162

**The defect.** The text guard named a section only by a literal
`<h1>`–`<h6>`, or by a `<section>`'s id or aria-label. A page built from the
kit writes `<SectionHeader title="Today's bake" />`, which a visitor sees as an
`<h2>`. So 'Remove the "Today's bake" section from the home page.' was
refused with a correct answer (409 `prose-preservation`,
`unconfirmed-target`), and the refusal asked for the heading the request had
given. The owner reproduced it independently: refused with `SectionHeader`'s
`title`, accepted with the equivalent literal `<h2>`.

**The rule now.** A kit component's heading names the section it opens, and
only where all of this is established; anything short of it stays uncertain,
which names nothing and so authorizes nothing.
- **Which component is the page's own import**, never the tag's spelling:
  `@/components/ui/<module>` (the template's one path alias; `.tsx` allowed),
  by name, under any alias (`SectionHeader as Heading`) or namespace
  (`UI.SectionHeader`). A default import, a type-only import, a local component
  called SectionHeader, a relative path, a name two imports bind and a name the
  page declares again are not it.
- **Which prop heads it** comes from `builder/kit-headings.mjs`, generated by
  `builder/gen-kit-headings.mjs` from each component's own source with the
  TypeScript parser: the prop the component always shows whole in a visible
  `<h1>` or `<h2>`. "Always" means one `return`, reached from the function body
  itself; nothing around the heading but plain HTML elements, a fragment or
  brackets; no condition but the prop's own truthiness; and nothing hiding it.
  **Of 64 components that show a prop as a heading's whole text, 20 qualify**,
  `SectionHeader.title` among them. Of the 44 left out:
  - 19 are card titles in an `<h3>` (`DishCard`, `PractitionerCard` …): naming
    a card must not authorize the section around it;
  - 19 can return without the heading (`CounterServices` …);
  - 6 are left out for other reasons: three `<h3>`s with a further reason, a
    condition on another prop (`HouseRules`), a heading reached through a
    variable (`StoryLead`), and one inside another component (`WelcomeCard`).

  A `title` shown in no heading at all (`Callout`) is not even
  a candidate. `test/kit-headings.test.mjs` re-derives the table and compares,
  so a kit change cannot leave a stale copy granting permission.
- **The value is a literal** (`title="…"` or `title={"…"}`), given once, on an
  element with no spread and nothing hiding it. A computed or template title is
  not known here.
- **It opens its section**: nothing that could show a heading comes before it
  there, whether a literal heading or another component. A second kit heading
  further down (a widget's title, a call to action) names that part, not the
  section around it. The literal reader keeps its own rule.
- **It names the whole section and nothing narrower.** "The X section" and "X"
  grant; "the X heading" and "the text under X" do not, because the kit's words
  are a prop, not prose the guard reads. They still count as a mention, so a
  name a kit heading shares with any other heading grants nothing.

**Measured over the 324-page corpus, with the product's own reader before and
after.**
- The table's components are used 890 times, 878 of them with a literal value;
  `SectionHeader.title` is 839 of them.
- Of the 616 sections that hold literal prose, 287 had a name before and 573
  have one now: 286 gained, none lost, and 43 still have none.
- Pages where no prose section had a name went from 86 to 10.
- The earlier scratch census counted 555 prose sections, with a different
  reader; its count of 329 unnamed agrees with this one.

**Evidence.** `test/edit-page-keep.test.mjs` gains 30 cases, and
`test/kit-headings.test.mjs` is new with 5. Every answer is supplied.
- **Through the real edit route, on both money paths:**
  - the `SectionHeader`-headed section's removal publishes, with both
    photographs and the site's own order form kept and no judge call;
  - the literal `<h2>` equivalent publishes too (the control);
  - that removal plus an unrelated paragraph lost is refused, for a kit and for
    a literal heading;
  - a request naming another page grants nothing, for both;
  - duplicate headings grant nothing, kit with kit and kit with literal;
  - a removal that also loses a photograph is withheld by the photograph wall;
  - one that also drops the order form is withheld when the judge finds it was
    not asked.
- **On the synchronous path:**
  - an alias and a namespace import publish;
  - a page's own SectionHeader, the name declared again on the page, a title on
    a component that shows it in no heading (`Callout`), a computed title and a
    heading that does not open its section each name nothing and refuse;
  - "the text under" a kit heading grants nothing while the literal heading's
    does;
  - a kit heading sharing its name with a literal one makes "the text under"
    it ambiguous.
- **A unit case** over every import and value shape, including a missing or
  throwing import reader (the kit's headings stay uncertain, the literal ones
  still name).
- **Red on the unfixed `6db00c42`: exactly 5 of the first 29** — the unit case,
  the kit removal on both paths, the alias and the namespace import. The 24
  refusals and controls pass on both. The 30th case was added after the red run
  for a probe and cannot be red there (the old code refuses everything
  kit-headed).
- **The owner's own reproduction pair is cases 2 and 3**: refused and accepted
  on the unfixed tree, both accepted now.
- **The rehearsal on fold-lane-bakery's real stored page** (scratch) now
  publishes the removal.

- **Probes, not a sweep** (`scripts/mutants/kit-headings.json`, over the four
  test files that can see the change):
  - 31 mutants: 30 killed, 1 survived, none that never applied, and both
    comment-only controls survived.
  - The survivor, a default import taken for the component, was inert by
    construction: a default import binds `default`, which no table key can be.
    So the clause was removed rather than kept, and the spec keeps the other 30.
  - The three swept files were byte-identical to their backups afterwards.
- **Suite 8,008 locally** (`8008 / 8006 / 0 / 2`), +35 against 7,973 — exactly
  the new cases.
- **CI on `2f2fed58`**: unit run `36231283319` reads `8008 / 8004 / 0 / 4`
  (the total matches; `pass` differs by CI's four skips). All 35 new cases pass
  by name, and none of the parent run's 7,973 names is missing. There are 8,008
  distinct result numbers and zero `not ok`. **`site build` run `36231283322`
  on `2f2fed58` passed**, all twenty steps (08:56:38 → 09:17:07Z, 20m29s),
  with all twelve counts read out of its per-step files: TAP 397/397/0/0,
  kit-typecheck 4, site-build 404, contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, and kit-render /
  kit-a11y / kit-effects / kit-paint `all passed`; census 7 + 4 + 1 = 12. The
  only `##[error]` lines are the two known annotations, and `site-build.mjs`
  took 14m44s.
- **The image.** `builder/kit-headings.mjs` joined the Dockerfile's worker COPY
  line, so a merge rebuilds. The predicted id at `2f2fed58` is
  `209c520fb8b06cd3`, from 188 inputs (158 distinct paths); main reads
  `05750a5120d33570` (187), as recorded.

**The rendering context — the owner's review of `2f2fed58`, closed on the
branch at `5ec82214`.** The owner found one gap before merging: the heading's
own attributes were checked, but not what surrounds it. For 'Remove the
‘Today’s bake’ section from the home page.', `2f2fed58` accepted deleting this
whole section:

```
<section>
  {false && <SectionHeader title="Today’s bake" />}
  <p>Keep this unrelated public information.</p>
</section>
```

It did the same with the heading inside `<div hidden>` or an unknown
`<Opaque>` wrapper. *"A heading that cannot be established as rendering must
not authorize deletion of visible siblings."* Reproduced first: 15 of 15 such
shapes were accepted.

- **The rule now.** A kit heading names its section only where it renders
  whenever the section does:
  - nothing on the heading may hide it: `hidden`, `aria-hidden`, `style`,
    `popover`, a spread, a hiding class, or a class that is not a quoted
    string;
  - every step between it and its section is a fragment or one of a fixed list
    of plain HTML elements that show their children (`div`, `span`, `header`,
    `footer`, `main`, `nav`, `aside`, `p`, the list elements, `a` and a few
    more), with nothing hiding it by the same rule;
  - anything else leaves it uncertain: a braced expression (a condition, either
    arm of a ternary, a fallback, a `.map`, even a bare `{<…/>}` or a prop
    value), a component or member tag (`<Opaque>`, `<ui.Box>`,
    `<motion.div>`), or an element that does not simply show its children
    (`<details>`, `<dialog>`, `<template>`, `<noscript>`, `<svg>`, a custom
    element);
  - the section's own attributes are not asked: they show or hide the heading
    and its neighbours together;
  - an uncertain heading still comes first, so a heading after it does not
    open the section.
- **One class rule for the heading and every step**, the kit table's own:
  `hidden`, `invisible` or `sr-only`, with any breakpoint or state prefix
  (`md:hidden`, `group-hover:invisible`). Two effects on the heading element
  itself: `overflow-hidden` no longer counts as hiding (the old word-boundary
  test read it as `hidden`), and a computed or template class now counts as
  uncertain.
- **Measured over the 324-page corpus, with the product's own reader: no
  change.** All 573 named prose sections stay named and none loses its name.
  Every literal name is unchanged, and 701 sections carry a kit name before
  and after. Of the 796 kit headings inside sections, 372 stand directly in
  them, 419 sit behind plain `<div>`s (one also passing through an `<aside>`),
  and 5 sit behind a condition or the kit's `MediaObject`. Those 5 already
  named nothing on `2f2fed58`, because something came before them.
- **Test 4a's Part A is unaffected**: the rehearsal on fold-lane-bakery's real
  stored pages (scratch) still publishes the "Today's bake" removal, 13 of 13.
- **Evidence.** 9 new cases in `test/edit-page-keep.test.mjs`, every answer
  supplied:
  - a unit case: 37 shapes that do not establish rendering name nothing — all
    37 named the section on `2f2fed58` — and 9 positive controls name it
    (directly, behind nested `<div>`s with `overflow-hidden`, a `<header>`, a
    fragment, an id with a literal class, a braced literal class, an alias, a
    namespace, and the heading's own `overflow-hidden`). It also covers the
    uncertain-first rule and the section's own attributes;
  - through the real edit route on both money paths: the owner's three shapes
    are refused (409 `prose-preservation`, `unconfirmed-target`, nothing
    compiled or stored, no charge or reservation, nothing bought by the
    browser); the same heading inside ordinary visible elements publishes,
    with both photographs and the order form kept;
  - **red on `2f2fed58`: exactly 7 of the 39 kit cases** — the unit case and
    the six route refusals. The two route controls and all 30 earlier kit
    cases pass on both. The unit case fails first there on its one loosened
    control (the heading's own `overflow-hidden`); with that control cut, it
    fails on the owner's `{false && …}` section;
  - **a positive control caught a trap before it shipped**: the parser
    adapter's `k()` reads a template literal back as `FirstTemplateToken`, an
    alias in TypeScript's kind enum, so a check against
    `NoSubstitutionTemplateLiteral` could never match. A class is now read only
    as a quoted string, which is how the title value was already read;
  - **the value reader's own spread check was dead** once the heading's
    attributes are cleared first, so it was removed; K-10, K-11 and K-12 in
    `scripts/mutants/kit-headings.json` are re-anchored to the shared check;
  - **probes, not a sweep**, over the same four test files (`edit-page-keep`,
    `kit-headings`, `site-tweak`, `edit-page-contract`):
    `scripts/mutants/kit-render.json`, one mutant per clause of the rule, 22
    mutants, 22 killed, 0 survived, 0 never applied, its comment-only control
    surviving; and `kit-headings.json` re-run, 30 mutants, 30 killed, both
    controls surviving. The three probed files were byte-identical to their
    pre-probe copies afterwards;
  - **suite 8,017 locally** (`# tests 8017 / # pass 8015 / # fail 0 /
    # skipped 2`, `duration_ms 117,272`), +9 against 8,008, exactly the new
    cases;
  - **CI on `5ec82214`**: unit run `36234086257` reads `# tests 8017 / # pass
    8013 / # fail 0 / # skipped 4` (`duration_ms 119,899`); the total
    matches, and `pass` differs by CI's four skips. All 9 new cases pass by
    name, and none of the parent run's names is missing (run `36231869456` on
    `e240f78a`, 8,008). There are 8,017 distinct result numbers and zero
    `not ok`. **`site build` run `36234086268` on `5ec82214` passed**, all
    twenty steps (09:52:35 → 10:17:13Z, 24m38s), with all twelve counts read
    out of its per-step files: TAP 397/397/0/0, kit-typecheck 4, site-build
    404, contrast-cases 16, theme-seam 11, theme-render 29, site-routing 14,
    site-runtime 47, and kit-render / kit-a11y / kit-effects / kit-paint `all
    passed`; census 7 + 4 + 1 = 12. The only `##[error]` lines are the two
    known annotations, and `site-build.mjs` took 17m59s.
- **The image.** `builder/page-prose.mjs` is an image input, so a merge
  rebuilds. The predicted id at `5ec82214` is `369d7b1e5bae25b0`, from 188
  inputs (158 distinct paths); the same reader reproduces `2f2fed58`'s
  `209c520fb8b06cd3` and main's `05750a5120d33570`. **Deploy 2162 built and
  rolled exactly that id** when `ab74d0d9` was merged (2026-09-26, 20:31 UTC).

**Limits.**
- Every writer and judge answer is supplied, so what a real model writes is
  unproven until Test 4a's Part A.
- A heading this rule leaves uncertain still refuses, as before the fix: a
  component that can return without it, one that shows it through a variable,
  a computed title, and a kit heading that does not open its section.
- A class that hides through CSS this check does not read — the site's own
  stylesheet, `opacity-0`, a zero size — is not read, here or in the kit
  table.
- A kit wrapper that always shows its children (a layout component) is
  treated as unknown: the table describes headings, not wrappers.
- **Found, not changed: the literal reader has no rendering check.**
  `{false && <h2>Today’s bake</h2>}`, `<div hidden><h2>…</h2></div>` and
  `<Opaque><h2>…</h2></Opaque>` each name the section, and removing its
  visible paragraph is accepted (measured). In the corpus, 4 of the 278 literal
  headings with words inside sections sit behind a condition. The owner
  bounded this correction to the kit recognition, so aligning the literal
  reader is separate work.
- **Found, not changed:** the literal reader names a section by **every**
  literal heading inside it. So "Remove the ‘Sourdough’ section", naming a
  card's `<h3>`, authorizes the whole enclosing section's prose. The kit rule
  is deliberately narrower (h1/h2 only, the heading that opens the section).
  Aligning the literal reader is separate work.

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
- **A failed restore after a publish failure of ours was not said — fixed,
  merged and deployed in deploy 2161** (the top section). `compileMsg`
  answered a failure of ours (and a refused reservation) with its own
  sentence, which dropped the one carrying "the change is saved". Every arm now
  takes the restore's result.
- **The stylesheet check read the whole stored sheet, not this message's rules
  — fixed, merged and deployed in deploy 2161** (the top section). A rule left
  dead by an earlier change started the correction round on any later message
  that picked the css lane, and the correction rewrote a rule the customer
  never mentioned. A publish is now held only for the rules the request wrote.
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
