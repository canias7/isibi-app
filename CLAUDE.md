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

- **`main` is `a64729ad`, deploy 2166** (2026-09-29 02:51 UTC, image
  `6fbaccad82fe879d`, predicted on both ends and built) — **runtime-confirmed
  by the owner's free press, run 54** (03:36 UTC, on `fold-lane-bakery`): both
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
- **The branch `claude/help-needed-ehlwlj`** is `main` plus documents (deploy
  2166's record and Test 6's runs). A press from the branch runs the branch's
  script against main's Worker.
- **Balance 37** on the building account after run 57 (2026-09-29 04:19
  UTC): routing 2 and the job's reserves of 1 and 2, ledger rows 335 and 336;
  read again at 05:35 UTC after the free restore (run 58), with no row after
  336 and no job open. The unit
  suite is **8,241** at `9ed7da51`.
- **Closed by the owner, not to be repeated**: live test 2 (run 32); Test 3
  (run 34) with the stylesheet corrections (deploy 2161); the kit-heading fix
  (2162); Test 4a (runs 37 and 39); Test 4b's D1 (run 42) and the conditional
  recovery write (2163); the scoped rules acceptance (run 44 — `lido-axes-b`'s
  bookings stay closed); Test 5's page removal (run 49) and restoration (run 50)
  with the removal-door correction (2164); Test 6 (runs 57 and 58: a
  site-wide description and a Visit-only move stored and published from one
  message, unrelated content preserved, the redirects kept, and `8btpep`
  restored free).
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
- **Test 7 is proposed, not run** (2026-09-29; its claimed coverage narrowed
  after the owner's review): one message taking the counter photograph off the
  Visit page and moving the home page's order band above "Fed every morning
  since we opened", on `fold-lane-bakery` at `8btpep`, judged on the stored
  and published changes against exact expected hashes, with the free restore
  after. About 5–6 credits, up to about 25. **It tests the customer
  capability** (both changes stored and published, each on its own page)
  **through the look door**, where the router's instructions send two changes
  it can make in one turn. The routing review found no better candidate: a
  menu link removed beside a layout change is routed `look` too, and on that
  door no lane describes a menu item (backlog). The removal door given other
  work stays shown only with supplied answers. The plan is the checklist's
  *Test 7*.
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

- **Balance 37** on the building account after run 57 (2026-09-29 04:19 UTC;
  ledger rows 335 and 336, read again at 05:04). Before it: 45 at run 50's end
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
  `01790468089054-8btpep` (restored by run 58 after Test 6's retry),
  `fretwork-1` at `01790404806543-kk6qsh` (Test 3's removal kept), and
  `lido-axes-b` with its bookings closed (run 44, kept).
- **What things cost, measured** — routing 1–2 per message (it moves with the
  prompt cache); the page rung 6–22 (runs 21–37); a data or rules edit 1; a
  reframe 1; a site description 1 (runs 52 and 57); a quick-writer page step 2
  (run 57); the logo rung, a page move and a
  page removal 0 (`exempt`); a
  first build 11–45; a revise of the same site 17; an add-on 2–13 (runs
  47–52). **Quote a range or measure the run.** Nothing enforces a per-request
  cap (`edit_reserve` raises only above 100,000), so the balance is the only
  bound. The default builder model is grok (`DEFAULT_PICKER`), and a cold new
  account is one credit short of building (`buildFloor` 20 against a grant of
  20, the routing call spending 1 first).
- **The unit suite is 8,241** (`9ed7da51`): `8241 / 8239 / 0 / 2` locally,
  `8241 / 8237 / 0 / 4` on CI (run 36511517996) — **compare the totals, never
  `pass`**; CI skips four where a local run skips two. **`site build`** reads
  twelve counts green (read on `9ed7da51`, run 36511518084, from each step's
  log): TAP 397, kit-typecheck 4, site-build **404** (382 plus the browser
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
| `docs/deploy-record.md` | every deploy's image prediction and timings, 2137 → 2166 (add new ones here) |
| `docs/traps.md` | the full trap catalogue |
| `docs/backlog.md` | the open items: a one-line index, then each in full |
| `docs/history/` | dated records of every run and fix round, 2026-09-21 → 09-28, and the old status and live-state sections — indexed in `docs/history/README.md` |
| `docs/investigations/` | the milestone, text-preservation and add-on escalation investigations |
| `docs/components.md` | the kit's component list, generated (a test compares it byte for byte) |
| `agent-builder/CLAUDE.md` | the agent product's own record |
