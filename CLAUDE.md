# Go Farther

A customer describes a business in chat at **gofarther.dev** and gets a
published website at **`<slug>.gofarther.app`**. The site builder is the only
product: the media side was deleted on 2026-09-12 (`docs/platform.md`).

> **This file is the entry point**: the working rules, the approval
> boundaries, where things stand, the essentials of deploying and testing, and
> a map of the docs, which hold the full rules and the records.
>
> **At the start of every session, read
> [`docs/owner-preferences.md`](docs/owner-preferences.md)**: how the owner
> likes things done, and what needs their approval.
> [`docs/owner-notes.md`](docs/owner-notes.md) is the owner's running log (over
> 23,000 lines, newest entries first). **Search it when you need the history
> of a decision; don't read it whole.** Add a dated, plain-English entry to it
> for each change, and add a preference to `docs/owner-preferences.md`
> whenever the owner states one.
>
> **Keep this file short: it holds what is true now and the rules.** A
> change's story goes in a dated file under `docs/history/` and in the
> checklist; a deploy's readings go in `docs/deploy-record.md`; an open item
> goes in `docs/backlog.md`; topic law goes in its topic doc. When you compress
> an entry, keep its numbers. On 2026-09-28 this file went from 15,182 lines to
> 1,815 and then to 336, and nothing was deleted:
> [`docs/history/README.md`](docs/history/README.md) maps where every line went,
> and the full old file is `git show 86eb5703:CLAUDE.md`.
>
> **Nothing reads this file from disk. Two docs are read by tests**:
> `docs/owner-notes.md`'s "Names that must not be renamed" table (by
> `test/brand-rename.test.mjs` and `test/media-deleted.test.mjs`), and
> `docs/components.md` (compared byte for byte by
> `test/components-doc.test.mjs`). Keep both as they are.

## Where things stand (2026-09-29)

- **`main` is `907840c6`, deploy 2170** (2026-09-29 20:28 UTC, a
  fast-forward from `47dea9c0`; one deploy run, green, on `907840c6`; it
  built image `abf47dfeceba3c5c` from 188 inputs, predicted on both ends, and
  the container moved `dd4f72842234135b` → `abf47dfeceba3c5c`) —
  **runtime-confirmed by the owner's free press, run 65** (21:51 UTC, on
  `fold-lane-bakery`): both readers answer `907840c67497`, a cold container
  gets `abf47dfeceba3c5c`, and queued jobs and the runner are on. Nothing
  under `public/` changed. It carries **the router's
  whole-message rule, by targets** (below). `docs/deploy-record.md`.
- **Deploy 2168** (`47dea9c0`, 2026-09-29 16:35 UTC, a fast-forward from
  `cb981a4a`; the one push started two deploy runs a second apart, 2168 and
  2169, both green on the same commit, and both built image
  `dd4f72842234135b`, predicted on both ends) was **runtime-confirmed by the
  owner's free press, run 62** (16:57 UTC, on `fold-lane-bakery`): both
  readers answered `47dea9c01fbf`, a cold container got `dd4f72842234135b`,
  and queued jobs and the runner were on. Nothing under `public/` changed. It
  carries **the look door's menu lane** (below).
- **Deploy 2167** (`cb981a4a`, 2026-09-29 14:03 UTC, image
  `65ce683607928f0e`, predicted on both ends and built; a fast-forward from
  `a64729ad`) was **runtime-confirmed by the owner's free press, run 59**
  (14:53 UTC, on `fold-lane-bakery`): both readers answered `cb981a4ad1d3`, a
  cold container got `65ce683607928f0e`, and queued jobs and the runner were
  on. The served `chat.js` is
  byte-identical to the merged file (788,171 bytes, `82f36de3…`). It carries
  **the photo-removal correction**: "take the photo off" takes the
  photograph's element off (`remove`, found in the page's syntax tree), "keep
  the space" empties the frame (`clear`), contradictions and what cannot be
  taken off safely are refused by name, and `photosTakenOff` drives the undo
  hint. **Its limits stand**: a photo held by a larger block or written inside
  code is refused (20 of 210 on the stored test pages); an emptied wrapper
  with its own meaning is kept (21 of 190); two photos sharing a description
  are refused; a job run inline in the Worker, with no parser, refuses every
  removal. A real picture model answered `remove` for a removal in Test 7's
  run 60 (closed by the owner).
  `docs/history/2026-09-29-photo-removal.md`.
- **Deploy 2166** (`a64729ad`, 2026-09-29 02:51 UTC, image
  `6fbaccad82fe879d`) was **runtime-confirmed by the owner's free press, run
  54** (03:36 UTC, on `fold-lane-bakery`): both
  readers answer `a64729ad741a`, a cold container gets `6fbaccad82fe879d`, and
  queued jobs and the runner are on. The served `chat.js` and `edit-poll.js`
  are byte-identical to the merged files. On top of deploy 2165 it carries the
  canary's read of the description stored in a site's settings (`2a7767cc`:
  `readStoredHead`, the app's own SEO route read in every inventory) and **the
  per-operation scope fix (`9a79fc2d`) with its correction after the owner's
  review (`9ed7da51`)**: the router puts off only what its answer cannot do
  this turn; a part it puts off is taken out of the message before anything
  runs (`heldBack`, echoed as `deferred`, refused at no cost when it cannot be
  found: `route/held-unread`); and the picker names each change's page and
  words (`scopes`), so each runs on its own page with its own words. **An
  answer with no scope metadata runs as before. On a scoped answer, a change
  whose page is not a path or whose words are not in the message, a page the
  site does not have, and a picked lane left unscoped are withheld at no cost
  with their own sentence (`picker/scope-unread`, `page/no-page`) while the
  rest runs: never widened to the whole message, never sent to the home
  page.** The withholding is proven with supplied answers
  (`test/edit-op-scope.test.mjs`, and the scoped door case in
  `test/edit-removal-door.test.mjs`); run 57 exercised the scoped path live,
  where nothing needed withholding. `docs/history/2026-09-29-op-scope.md`.
- **Deploy 2165** (`f5e941f4`, image `8a10715339cdc780`) was runtime-confirmed
  by the owner's free press, run 51 (2026-09-28 22:57 UTC, on
  `fold-lane-bakery`): both readers answered `f5e941f494fd`, a cold container
  `8a10715339cdc780`, with queued jobs and the runner on. It carries the
  redirect fix (a publish reads the stored sidecar through `manifestFromCsv`):
  run 52's publish kept the bakery's stored redirect, read at once and ten
  minutes later. Redirects dropped between 2026-08-17 and that deploy are not
  rebuilt.
- **The branch `claude/help-needed-ehlwlj`** is `main` (`907840c6`) plus
  documents. A press from the branch runs the branch's script against main's
  Worker.
- **Balance 22** on the building account after run 66 (Test 8's second paid
  run, 2026-09-29 21:57–22:00 UTC): 28 → 22, routing 2 and the job's
  reserves of 3 and 1 (ledger rows 340 and 341), with no job open. Before it,
  28 after run 63 (Test 8's first paid run, 2026-09-29 17:03 UTC): routing 2
  and the job's reserve of 2, ledger row 339, read again after the free restore (run 64) at 17:30, with no row after
  339 and no job open, and again at 21:35 after deploy 2170 and by run 65 at
  21:51 (the same).
  Before it, 32 after run 60, unchanged through runs 61 and 62. The unit
  suite is **8,297** on `main` (`907840c6`): `8297 / 8297 / 0 / 0` locally
  (on `2771ed3f`, the same code) and `8297 / 8293 / 0 / 4` on CI (runs
  36622422731 on `2771ed3f` and 36625806573 on `907840c6`).
- **Closed by the owner, not to be repeated**: live test 2 (run 32); Test 3
  (run 34) with the stylesheet corrections (deploy 2161); the kit-heading fix
  (2162); Test 4a (runs 37 and 39); Test 4b's D1 (run 42) and the conditional
  recovery write (2163); the scoped rules acceptance (run 44 — `lido-axes-b`'s
  bookings stay closed); Test 5's page removal (run 49) and restoration (run 50)
  with the removal-door correction (2164); Test 6 (runs 57 and 58: a
  site-wide description and a Visit-only move stored and published from one
  message, unrelated content preserved, the redirects kept, and `8btpep`
  restored free); Test 7 (runs 60 and 61: a photograph's element taken off
  `/visit` with no placeholder and the home band moved, published together,
  unrelated content preserved, and `8btpep` restored free).
- **Test 6 is closed by the owner** (2026-09-29) for exactly what runs 57 and
  58 showed: one message's site-wide description and Visit-only band move,
  both stored and published; unrelated content preserved; the existing
  redirects kept; and the original version restored without charge. **Kept
  separate**: the reply omission (review #9) and the withholding paths (a
  part put off, a scope that fails its check), shown only with supplied
  answers. Component preservation is untested there (the fixture has none),
  and **real-model mixed work through the removal door is not reached by a
  natural message**: the router's instructions make several changes one
  `look` answer (Test 7's routing review).
  The record is the checklist's *Test 6*.
- **Test 7 is closed by the owner** (2026-09-29) for the customer behavior
  runs 60 and 61 showed: the Visit photograph's element removed without a
  placeholder, the home band moved, both published together in one message
  through the look door, unrelated site content preserved, and the original
  version (`8btpep`) restored free. **The stored home page's missing final
  newline is accepted as a specific nonfunctional exception for this
  acceptance only**: it stays recorded (backlog), no byte-for-byte
  preservation is claimed for that file, and no other whitespace change is
  exempt. **Kept separate**: the reply omission (review #9) and the remaining
  photo-removal limits (backlog). Not to be repeated. The photo-removal
  correction behind it is deployed in 2167 (`remove` takes the element off,
  `clear` keeps the space when asked). The record is the checklist's *Test 7*
  (*Run 60*, *Run 61*, *Closed*) and `docs/history/2026-09-29-photo-removal.md`.
- **The look door's menu lane is corrected, merged and deployed in 2168**
  (2026-09-29; runtime-confirmed by run 62). A menu change beside other work is routed `look`,
  and no lane there described the menu's items: the one lane that runs the
  menu editor (`action`) said "only that button", and run 47's real picker
  read "Take Gallery out of the menu." as `behavior`, which changed nothing.
  Reproduced through the route with supplied answers; **the fix is that lane's
  description** (the menu's items and the button), with `behavior` pointing
  there; the route is unchanged, because a scoped answer already hands the
  menu editor only the menu's words. 19 route cases, sync and queued: both
  executors with their own words, unrelated links kept, both partial
  outcomes, ordinary menu and button edits. Shown with supplied answers, and
  live by Test 8's run 66 (the real picker placed the menu change there).
  Required CI green on `f2783aef` (unit 36595193059: `8296 / 8292 / 0 / 4`;
  site build 36595193255: the twelve counts) and on `47dea9c0` (unit
  36597948276); the image rolled to `dd4f72842234135b`, as predicted.
  `docs/history/2026-09-29-menu-lane.md`.
- **Test 8 ran as run 63** (2026-09-29 17:02–17:06 UTC, 4 credits): one
  message, *Take Gallery out of the menu. Then, on the Visit page only, put
  the "Order a collection so we hold a loaf" band above "Come to the
  bakery".*, on `fold-lane-bakery` at `8btpep`. **The router answered `nav`
  with `remove` and held the band back (`alsoAsked`)**, against its own rule
  that several changes `look` can make are one `look` answer (backlog). So the
  removal door's menu step ran alone: Gallery out of every menu with the
  expected bodies, the gallery page kept, everything else preserved, one
  publish (`t5obxx`), the money exact; the band was not moved or charged, and
  the reply asked for it next (the held-back path's first live run since
  deploy 2166). **The look door was not reached**, so the real picker placing
  the menu change on the menu editor's lane is still shown only with
  supplied answers. **The free restore (run 64, 17:29 UTC) put `8btpep`
  back**, checked (stored pages equal to the fixture, markup and pixels
  identical to the before-read, no charge). **The owner recorded run 63 as a
  partial outcome** (the menu removal succeeded, the Visit move was deferred)
  **and accepted run 64**; the intended mixed-request acceptance remains open,
  and every earlier closure stays credited. The record is the checklist's
  *Test 8* (*Run 63*, *Run 64*, *The owner's review*). **Pressed again as run
  66** (21:56–22:00 UTC, 6 credits) after deploy 2170: the real router
  answered `look` with nothing held back, the look door's picker placed the
  band on `shape` and the menu change on the menu editor's lane (`action`),
  and both changes were stored and published exactly as expected (one
  publish, `li1j0y`, built from `8btpep`; everything else preserved, read at
  once and ten minutes later; `/order` and `/starter` identical to the
  pixel). Every acceptance item is met; the reply still names only the look
  (review #9, kept separate). The free restore is next; closing is the
  owner's decision. The record is the checklist's *Test 8* (*Run 66*).
- **The router chooses one answer over the whole message, by what a route
  can make on every page** (2026-09-29: `465efe11`, then `2771ed3f` after the
  owner's review of its first wording; **merged and deployed in deploy 2170**
  (`907840c6`, image `abf47dfeceba3c5c` as predicted) and
  **runtime-confirmed by run 65**). Run 63's `nav` + `remove` + `alsoAsked` came from instructions
  that disagreed: each layer's clause named the answer for the change a
  message leads with ("A MENU CHANGE IS "nav"", `remove` for a menu item),
  the several-changes rule sat inside `look`'s own paragraph, and
  `alsoAsked` judged a hold against the answer already chosen. The first
  wording chose by kind, which the owner corrected: two layout changes on two
  pages are one kind, and `page` edits one page. **The fix is three strings
  in `builder/site-ask.mjs`**: the `layer` field ends on one rule over the
  whole message, **by targets, never by kind** (a layer other than `look` is
  the answer when it can make every change on every page each one is on;
  when none can, `look`, if it can make them all, with nothing held back, so
  changes of one kind on different pages are `look`; a change is held back
  only when no one answer can make it with the rest); the `page` clause's
  older multi-page line (it said `addon`) points at that rule; and
  `alsoAsked` spares a part one answer can make with the rest, whatever the
  first change was, naming no answer of its own. The route is unchanged.
  Guard revised (one kind is no longer enough); red check (exactly the 2
  revised cases of 197 fail on the first wording and on `main`); sweep (16
  of 16, 3 controls survived); the existing two-page, single-change,
  menu-plus-layout and hold cases (20 of 20 and 18 of 18, supplied answers);
  Test 8's request replayed with both answers (2 of 2); full suite `8297 /
  8297 / 0 / 0`; required CI green on `2771ed3f` (unit 36622422731: `8297 /
  8293 / 0 / 4`; site build 36622422715: the twelve counts). **Its first live
  reading is Test 8's run 66: the real router answered `look` for that mix,
  with nothing held back** (one sample; how often, and for other messages,
  is not measured). The image rolled to `abf47dfeceba3c5c`, as predicted. `docs/history/2026-09-29-whole-message-routing.md`.
- **The short edit-path checklist** (demonstrated live · tested only with
  supplied model output · untested, material gaps first) is the top of
  `docs/investigations/edit-path-checklist.md`, and every test's plan, readings
  and closure are recorded there.
- **Parked or kept separate by the owner**: React #418 (hydration); the
  translator reading page code as text; D2 and D3 (grants apply and a real
  order on `fold-lane-bakery`); model-written replies; `lido-axes-b`'s
  still-visible booking invitation; the lost redirects; the QR code pointing at
  a removed page; the bare not-found text on Start sites; and a multi-step look
  reply naming only the look (review #9).
- **Codex's investigations** — the add-on escalation correction, the edit-path
  milestone and the literal-text guard — are in `docs/investigations/`.

## Approval boundaries

The owner's own words for each rule are in `docs/owner-preferences.md`.

- **Spending.** No paid run, model call or fal purchase without the owner's
  approval. Propose the exact request and a cost estimate first. An estimate
  is not a cap: nothing enforces a per-request limit, so the balance is the
  only bound.
- **Presses.** The owner presses every workflow run. A session's dispatch
  answers **403** (it lacks `actions: write`), even for a free check: try once
  only when asked, never retry, and hand over the exact inputs, naming each
  form box by its **description** (the form shows descriptions, not input
  names).
- **Git.** Work on `claude/help-needed-ehlwlj`. Merge to `main` and deploy
  only when the owner says so. No pull request unless asked.
- **Closed stays closed.** Don't repeat a closed test, or spend a run only to
  check it again. Closing is the owner's decision, after their own review.
- **Live data.** No booking, order, row write, grants apply, site deletion or
  database restore on a live site without approval. `lido-axes-b`'s bookings
  stay closed, and D2 and D3 are parked.
- **Secrets.** Never read a secret's value: select non-secret columns only,
  and record a secret's name, never its hint. Never mint or read an owner
  credential, and never describe how the account was topped up.
- **Network.** Never turn off TLS verification or unset `HTTPS_PROXY`, and
  never add the proxy CA to Chromium.
- **Scope.** Keep a found issue separate: record it in the backlog rather than
  widening the current milestone to fix it. No keyword- or fixture-specific
  rules. No broad sweep, new harness or redesign unless the owner asks.

## Working rules

- **Always show UI changes as screenshots in the chat** — render it headless and
  send the image. The owner reviews everything visually.
- **The owner directs design; don't restyle beyond what's asked.**
- **Don't spend fal credits or model calls on tests without asking first.**
- **Work on the designated branch**, not on main directly.
- **Never write GitHub's own skip-CI marker anywhere** — not in a commit message,
  not in a PR body, not while explaining it. GitHub scans the whole message and
  suppresses every workflow for that push: main moves, nothing deploys, nothing
  tests, and there is no red run to notice. **Done twice, both times inside prose
  about the rule itself.** In prose call it "the skip-CI marker" and never spell
  it. `test/deploy-secrets.test.mjs` holds the half that lives in the tree.
- **A merge runs the deploy and nothing else** (owner, 2026-09-09). Every
  other workflow is dispatch-only, except that `unit tests` still runs on
  every feature-branch push, and `site build` and `answer read` on one that
  touches their paths. So **nothing is checked automatically on `main`**: run
  what matters by hand before anything that matters.
  `test/merge-triggers.test.mjs` requires `deploy.yml` to be the only workflow
  a push to main starts.
- **The paid workflows are dispatch-only** (`build smoke`, `edit smoke`, `page
  gen eval`, `schema gen eval`), and their commit-marker gates are kept.
  **Never spell the smoke opt-in marker either**: a commit that quoted it
  bought a run (2026-09-01). Both rules in full are in `docs/deploy.md`.
- **Never commit while a mutation sweep is running.** A killed sweep skips its
  `finally` and leaves a live mutant in the tree.
- **Every change ships with**: guard tests, a mutation sweep from a verified-green
  baseline with a comment-only control that must survive, the full unit suite,
  entries here and in owner-notes, and a push.
- **Stamp measured numbers only AFTER the run.** A result written before the run
  ends is a claim ahead of its evidence.
- **Customer replies should EVENTUALLY be model-written from authoritative
  operation results** (owner, 2026-09-24: *"Record my future preference:
  customer replies should eventually be model-written from authoritative
  operation results. Do not implement that redesign now."*). Recorded, not
  started. Until then replies are composed deterministically in `editReply` —
  and the half that carries over is already the rule: **what a reply states
  comes from what the operations really did** (`pageOps`, `partial`, the diff,
  the ledger), never from the request's wording. **Kept for that work, not
  reopened** (owner, closing D1, 2026-09-27): the data rung's "✅ Updated one
  entry in loaves." names the table and not the change, because `applied`
  carries only the table, the row id and the column; the rules rung's "changed
  whether it's open" is the same kind of sentence.
- **Where a change is recorded now**: in this file, only what changed in the
  current state; the story in a dated file under `docs/history/` and in the
  checklist; a plain-English entry in `docs/owner-notes.md`. **The scope of
  the tests follows the owner's request**: recent rounds asked for focused
  tests and targeted probes, not a broad sweep.

## Where the code lives

The full map is `docs/platform.md`.

- **`public/`**: the browser app, plain HTML, CSS and JS with no build step —
  `index.html`, `styles.css`, `chat.js` (the builder's client and the agent
  builder's), `auth.js`, `edit-poll.js`, `site-list.js`, `site-zip.js`.
- **`worker.js`**: the Cloudflare Worker — the assets and the whole
  `/api/site/*`, `/api/db/*` and `/api/agent/*` surface. Tests can import it.
- **`builder/`**: the site builder. `lovable/template/` is the kit (React 19,
  Tailwind v4, TanStack Start, 2,112 components); `build-server.mjs` is the
  container's service; the rest are plain modules tested outside the Worker.
- **Supabase** (`ujrqdmmtcptvimazlhom`): sign-in, the credit ledger, the site
  tables (`site_backends`, `site_project`, `site_builds`) and the edit queue.
  **Neon**: one project per site. **R2**: every published build, the live
  pointer `current/<slug>.json`, page source and uploads.
- **`agent-builder/`** is a separate product with its own `CLAUDE.md`.

## Deploying, in brief

The rules in full are `docs/deploy.md`; each deploy's readings go in
`docs/deploy-record.md`.

- A push to `main` deploys (GitHub Actions, then Wrangler, then Cloudflare). A
  push that touches only `**.md`, `docs/**`, `LICENSE`, `test/**` or
  `scripts/**` starts **no deploy run**; one that touches a workflow does.
- **The container image is rebuilt only when its inputs change.** Before the
  push, predict the image id over both ends (`containerInputs` and `imageId`
  in `.github/scripts/container-images.mjs`); afterwards, read the log's
  `built` or `reused` line and its `-`/`+` image pair. Today there are 188
  inputs (158 distinct paths). GitHub masks each run of `1`s as `***`.
- **After an image roll, wait 15–20 minutes** before container work that must
  run the new code. A push that rolls nothing owes no wait.
- **A green deploy is not a runtime confirmation.** Say "deployed, not
  runtime-confirmed" until an authenticated read of `/api/site/build-health`
  (the owner's free canary press) answers with the new sha and image. When
  `public/` changed, byte-compare the served file with the merged one, taking
  the before reading first.
- **Before a merge**, check that nothing is in flight (Actions runs and edit
  jobs), required CI is green on the candidate, the image is predicted, and
  the rollback is verified in a throwaway worktree. A fast-forward's rollback
  is `git revert --no-commit <base>..<candidate>`, which must give back main's
  own tree.
- An optional secret needs a `|| fallback` in `deploy.yml`; a required one must
  not have one.

## The product, in brief

- **A build** (`POST /api/site/react-build`): route, design (one
  `design_schema` call), provision a Neon database only when tables are
  declared, generate (`write_pages`), compile (`tsc` reports; only `vite build`
  refuses), render check in a real Chromium, salvage, publish. The model's raw
  answer is kept at `source/<slug>/answer.json`. `docs/build-path.md`.
- **An edit** climbs a ladder, cheapest first: `text` · `data` · `rules` ·
  `look` · `picture` · `logo` · `nav` · `page` · `addon`. It climbs only where
  the climb is classified (`builder/edit-failure.mjs`); anything else is told
  to the customer at no cost for the edit. **Read `docs/architecture.md`
  first**, then `docs/edit-path.md`.
- **"Add" goes to the add-on step** (`builder/site-add.mjs`); an edit changes
  what is already there. `docs/addon-path.md`, which also has what is proven
  live for each add-on kind.
- **Every job runs in the site's own container, with no clock**: a 50-minute
  deadline and a 90-second lease. `docs/containers-and-jobs.md`.
- **Data, payments and mail**: one Neon database per site, with RLS on every
  table (ask `resolveAccess(t)`, never the preset name). Payments use the
  owner's own Stripe key and mail the owner's own key; `env.EMAIL` is ours,
  and the builder may not touch it. `docs/site-database.md`,
  `docs/platform.md`.
- **Credits**: 1 credit is $0.008. `use_credits` is a gate, not a till; a
  founder is never credited back; the build path debits and reverses by ref
  (`credit_debit`, `credit_reverse`). `docs/platform.md`.

## Live state

**Read the ledger; do not trust a number here.** A stale balance makes
`buildFloor` refuse before spending, and the refusal reads as a broken build.
Every earlier reading — the balance since run 9, the suite and site-build
stamps, how each was taken — is in `docs/history/2026-09-28-live-state.md`.

- **Balance 22** on the building account after run 66 (Test 8's second paid
  run, 2026-09-29 22:00 UTC): 28 → 22, routing 2 and the job's reserves of 3
  and 1 (ledger rows 340 and 341). Before it: 28 after run 63 (Test 8's paid
  run, 2026-09-29 17:03 UTC): 32 → 28, routing 2 and the job's reserve of 2
  (ledger row 339), read again at 17:30 after the free restore (run 64), with
  no row after 339, and at 21:35 after deploy 2170 and by run 65 at 21:51 (the
  same). Before it: 32 after run 60 (Test 7's paid run,
  2026-09-29 15:07 UTC): 37 → 32, routing 2 and reserves of 2 and 1 (ledger
  rows 337 and 338), read again at 15:27, at 15:37 after the free
  restore (run 61) and at 16:57 by run 62, with no row after 338. Before it:
  37 after run 57 (2026-09-29 04:19 UTC; ledger rows 335 and 336, read again
  at 05:04, and unchanged through runs 58 and 59). Before that: 45 at run 50's end
  (2026-09-28 18:41 UTC): run 49 took it 50 → 45 (routing 2 + 1 and the menu
  edit's reserve of 2, ledger row 333; the page removal `exempt`). Run 51
  (22:57 UTC, free) read 45 again. Run 52 (Test 6's paid run) took it 45 → 42:
  routing 2 and the job's reserve of 1 (ledger row 334). Run 54 (free,
  2026-09-29 03:36 UTC) read 42 again, with no ledger row after 334. Run 57
  (the Test 6 retry, 04:18 UTC) took it 42 → 37: routing 2 and reserves of 1
  and 2. `GET /api/fal-balance` answers fal's balance separately.
- **The building account is `aniascristian@gmail.com`**, not the session's own
  address. It owns every live site and holds that balance; look at the wrong
  row and the balance reads zero.
- **Live sites**: `northgroup-5`, `-9` … `-17`, `markbook-1`, `shoeroom-1`,
  `repairbench-1`, `fretwork-1`, `ashgrove-1`, `washhouse-1`,
  `ben-crowe-guitar`, and the older `fold-lane-bakery`, `harbourside-roast`,
  `the-lido-cafe`, `oak-and-ash`, `forno-and-co`. **Reusing one of those slugs
  revises that site.** The test fixtures now: `fold-lane-bakery` live at
  `01790719081409-li1j0y` (Test 8's run 66; the free restore to
  `01790468089054-8btpep` is next),
  `fretwork-1` at `01790404806543-kk6qsh` (Test 3's removal kept), and
  `lido-axes-b` with its bookings closed (run 44, kept).
- **What things cost, measured** — routing 1–2 per message (it moves with the
  prompt cache); the page rung 6–22 (runs 21–37); a data or rules edit 1; a
  reframe 1; a site description 1 (runs 52 and 57); a quick-writer page step 2
  (run 57); a quick-writer move with a photograph removal in one job 3 (run
  60); a menu edit 2 (runs 49 and 63); a menu edit and a page move through the
  look door in one job 4 (run 66); the logo rung, a page move and a
  page removal 0 (`exempt`); a
  first build 11–45; a revise of the same site 17; an add-on 2–13 (runs
  47–52). **Quote a range or measure the run.** Nothing enforces a per-request
  cap (`edit_reserve` raises only above 100,000), so the balance is the only
  bound. The default builder model is grok (`DEFAULT_PICKER`), and a cold new
  account is one credit short of building (`buildFloor` 20 against a grant of
  20, the routing call spending 1 first).
- **The unit suite is 8,297** (`907840c6`, deploy 2170): `8297 / 8297 / 0 /
  0` locally (on `2771ed3f`, the same code), where the two `sheet-rtl`
  browser cases run because the template's dependencies are installed, and
  `8297 / 8293 / 0 / 4` on CI (runs 36622422731 on `2771ed3f` and 36625806573
  on `907840c6`) — **compare the totals, never `pass`**; CI skips four.
  (Before the router's correction: 8,296 at `47dea9c0`, `8296 / 8296 / 0 / 0`
  locally and `8296 / 8292 / 0 / 4` on CI, runs 36595193059 and
  36597948276. Before the menu-lane correction:
  8,277 at `cb981a4a`, `8277 / 8277 / 0 / 0` locally and `8277 / 8273 / 0 / 4`
  on CI, runs 36539848541 and 36542727770. Before the photo-removal
  correction: 8,241 at `9ed7da51`, `8241 / 8239 / 0 / 2` locally and `8241 /
  8237 / 0 / 4` on CI, run 36511517996.) **`site build`** reads the same
  twelve counts green on `9ed7da51` (run 36511518084), on `4ee123d2` (run
  36539848416), on `f2783aef` (run 36595193255) and on `2771ed3f` (run
  36622422715), each read from each step's log: TAP 397, kit-typecheck 4, site-build **404** (382 plus the browser
  control's 22), contrast-cases 16, theme-seam 11,
  theme-render 29, site-routing 14, site-runtime 47, and kit-render, kit-a11y,
  kit-effects and kit-paint `all passed` (census 7 + 4 + 1 = 12). Its two
  `##[error]` annotations (`index.tsx(50,13) TS2322`, `menu.tsx(27,17)
  TS2339`) sit inside the case that compiles a broken page on purpose.
- **Running the suite here**: `node --test "test/*.test.mjs"` with the glob
  quoted; `playwright-core` at the root (`npm i --no-save`, the template's
  version); a worktree needs `node_modules` linked in; nothing of ours already
  running (`pgrep -af build-server.mjs`, then kill by PID); a shallow clone can
  fail `site-searchpath`'s ancestry case, so unshallow it. **Measure a baseline
  in a worktree; never subtract from a paragraph.** The stamp chain ends at the
  last commit that moved a test or product file.
- **Reading CI**: read a job's own top-level fields (`status`, `conclusion`),
  never a pattern over its JSON (every step carries the same keys); ask for runs
  by branch, never by `?head_sha=` (it answers 0 for shas that have runs); count
  distinct result numbers, not lines (a byte-order mark hides one); read counts
  from the per-step log files; the site-build job has twenty steps and the API
  answers 23.

## The traps, in brief

Every trap cost at least one session. **Read `docs/traps.md` before writing a
guard, a sweep, a harness or a CI reader.** The ones met most often:

- **The wiring layer.** A module can be right with one hop cut. Before
  rewording a prompt because a field came back empty, check that the field can
  arrive, following the chain from the producer.
- **Assert the property, not the spelling.** Read source landmark to landmark,
  never by bytes, and assert that both landmarks exist first.
- **A negative assertion must prove its observer is alive** (`[].every()` is
  `true`). Blank comments before a scan: prose contains the thing it forbids.
- **A surviving mutant is a question about the mutant first.** Measure both
  versions, check every anchor before the run, never commit while a sweep
  runs, and never restore with `git checkout` (it restores HEAD, not your
  edits).
- **`pgrep -f` and `pkill -f` match your own shell.** Wait on a PID.
- **Cannot-tell must never read as a value.** Refuse a non-string rather than
  coerce it (`String(["a"])` is `"a"`), and use `Object.hasOwn` for a caller's
  key.
- **A fixture must come from its real producer**, including a supplied router
  answer, which must be the one the router is told to give (run 47).
- **A green harness proves the path it took.** Judge a test by what its
  operations did (the stored reply, the publishes, the source, the addresses),
  never by counting replies (run 47).
- **A rule that is true because of a layer below it expires when that layer
  moves**, and nothing announces it.
- **Read CI from a job's top-level fields**, ask for runs by branch (never
  `?head_sha=`), and compare suite totals, never `pass`.

## Where everything else lives

| Doc | What it holds |
|---|---|
| `docs/owner-preferences.md` | how the owner likes things done, and the approval boundaries — read at session start |
| `docs/owner-notes.md` | the owner's running log, newest first — read on demand; it holds the "Names that must not be renamed" table |
| `docs/investigations/edit-path-checklist.md` | the short edit-path checklist, and every test's plan, readings and closure (Test 6's plan is there) |
| `docs/architecture.md` | the owner's drawing: build, then edit / add-on / delete on one spine |
| `docs/edit-path.md` | the ladder, what the edit path does now, what an edit may add, what the page rung preserves, the 21 lanes, renaming |
| `docs/addon-path.md` | the add-on in brief, what is proven live per kind, its kinds and requirement report, photographs, QR codes, outside connections |
| `docs/site-database.md` | the four backend states, the `search_path` pin, column-scoped write grants |
| `docs/containers-and-jobs.md` | no clock in the container, the model-call transport, where a job ran, the probes |
| `docs/build-path.md` | how a site gets built, the design call, the published site, the code explorer, the design and page splits |
| `docs/instruments.md` | the free instruments, what a paid harness refuses, the edit canary and its modes |
| `docs/app-rules.md` | the builder app's rules, the model table, and the agent builder's half in this app |
| `docs/platform.md` | the two halves, where the code lives, data, auth, payments and mail, credits |
| `docs/deploy.md` | what a push starts, the paid workflows, the image predictor, runtime confirmation, the served-file check, secrets, rollback |
| `docs/deploy-record.md` | every deploy's image prediction and timings, 2137 → 2170 (add new ones here) |
| `docs/traps.md` | the full trap catalogue |
| `docs/backlog.md` | the open items: a one-line index, then each in full |
| `docs/history/` | dated records of every run and fix round, 2026-09-21 → 09-28, and the old status and live-state sections — indexed in `docs/history/README.md` |
| `docs/investigations/` | the milestone, text-preservation and add-on escalation investigations |
| `docs/components.md` | the kit's component list, generated (a test compares it byte for byte) |
| `agent-builder/CLAUDE.md` | the agent product's own record |
