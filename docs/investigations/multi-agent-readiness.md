# Multi-agent readiness: what runs concurrently, what waits, what is unsupported, and the release proposal (2026-10-09)

> **Released as deploy 2189** (2026-10-09, `main` `0fd50fd2`, image
> `6c9fc805fe4de0d8`, on the owner's word); press A prepared on the branch
> (`ab94386f`). Written before the release, when it was not merged, deployed
> or built. No paid call, no model call, no container image build, no live
> database change. Production is deploy 2188 (`main` `9d6bda8a`, image
> `335396c8c0e0fbcb`).

The owner's order (2026-10-09), after Codex confirmed the attachment
correction on `604d2415`: close the attachment fix, then finish the overall
multi-agent readiness review from the existing implementation and test
evidence:
- show which Edit, Add-on and Build tasks execute concurrently, which wait
  for dependencies or shared-site writes, and which stay sequential or
  unsupported;
- add focused offline tests only for a concrete uncovered requirement, and
  fix any demonstrated blocker;
- keep Build's limits of one page and fifteen components;
- prepare one release-and-validation proposal.

**The attachment fix is closed.** Codex confirmed it on `604d2415`: 59
focused offline tests passed, including their own mixed valid-and-malformed
reproduction, and unit and site-build CI are green. **The Add-on preserves
attachments; it does not consume their image contents.** That is not a
feature here, and nothing below claims it.

## 1. The model in one paragraph

A message on an existing site, with `REQUEST_FLOW` on, becomes **one request
of parts** (`builder/request.mjs`):
- the router names the parts, their order (`dependsOn`) and each change's
  targets;
- code checks the plan, adds what each step is known to write, and makes a
  part wait for anything another part creates;
- **one driver** files each part's job (`advanceRequest`).

**Writes to one site are one at a time**, enforced by the database's own lock
(`edit_claim` takes `private.site_busy`). The concurrency is *before* the
writes:
- up to three other parts per request are **prepared** beside the running
  job: their model calls and picture purchases are made and recorded, with
  nothing written and nothing charged;
- the part's own job is then answered from that record only for a call that
  is byte for byte the one prepared. Any other call is made live, against the
  site as it is.

A first Build is one job of its own, with its own internal concurrency.

## 2. What runs concurrently, what waits, what is sequential

| Path | Concurrent | Waits | Sequential or unsupported |
|---|---|---|---|
| Edit: text, menu (`nav`), picture, look, page (tweak and rewrite), data, rules | **Preparation**: the step's model calls, and the picture step's purchase, beside another part's job | its step is prepared only when no earlier unapplied part writes what it reads: the text and page steps read every page, menu reads the menus and page list, picture reads the pictures, look reads the theme and pages, data and rules read the tables. A routing reads the page list | **Applying**: one job at a time per site |
| Edit: logo | routing only (the step makes no model call) | as above | applying |
| Add-on, no new database; list entries | **Preparation**: picker, designers, seed net and page writer | behind any earlier unapplied page, theme, menu, page-list or picture write (its writer reads them); a later routing waits for an addition (it changes the page list) | applying; **its photographs are bought by its job**, through the purchase record |
| Add-on needing a new database | preparation up to its design | — | provisioning onward, in its job |
| Full rewrite of every page | — | waits for the customer's go-ahead on the request | **one queued build** after the go-ahead |
| Add-on photograph whose purchase is unknown | the addition publishes; the part is held | placed later into its marked frame by a placement step | a token inside a longer string, and any job outside a request, are never placed automatically |
| **Build (first build)** | the design graph's agents by their needs (existing); **photographs beside the page writing**; fonts and translations beside the photographs | the image step joins the photographs | provisioning → schema → seed, look merge, compile, render check, publish. **1 page and 15 components** (`MAX_PAGES`, `MAX_COMPONENTS` in `builder/site-plan.mjs`, unchanged since production) |
| **A message mixing a first Build with edits** | — | — | **unsupported**: a first Build is never a request part (L2) |
| **Two messages on one site** (two requests) | each request prepares its own parts | the site's lock defers one request's job while the other's holds the site | a preparation does not consider the *other* request's unapplied writes; it can be wasted (our cost), never applied stale (**XR, new**) |
| Two different sites | independent | — | no cross-site limit |

**Limits in force**:
- `PREP_MAX_LIVE = 3` preparations per request;
- `PREP_TRIES = 2` per step;
- a preparation is taken again after `PREP_FRESH_MS` (10 min);
- one write per site.

There is **no switch for preparation alone**. With `REQUEST_FLOW` on, it
runs for every request.

## 3. Requirement by requirement: the evidence

**"Offline"** means the real Worker routes, request driver, queue consumer,
cron and (where named) the build consumer, with every model answer and the
image service supplied, and the network blocked. **"Live"** means a paid press
on production. Live runs so far were on deploy 2188, which has the sequential
request flow and **none of the preparation work**.

| Requirement | Verified offline (tests) | Live evidence | Not shown |
|---|---|---|---|
| **Independent tasks overlap** | P1 (a photograph prepared and bought inside the link job's model call, by a gate); PATH look, page, add-on page, add-on row, data, rules and page tweak; BATCH (seven tasks, three preparations at once, five routed during task 0's job); P7 (Edit + Add-on) | **none**: preparation is not in production | whether real routers name targets precise enough to allow overlap; real timings |
| **Dependency ordering** | P2 (a link named before the page it needs), B1, B2, M3, BATCH (menu link after its page), `inferNeeds` units; cycles refused | run 107 message 1 (link after page, "order held"); run 95 R1 | the order with preparation on (it is the same driver; the gating is new) |
| **Conflicting changes** | P3 (same page: routing prepared, step held), P3b (a shared component named by the model), REVALIDATED (a page changed after preparation: asked again, the change kept), BATCH (heading after the photo on one page), **XR** (two requests on one page) | — | live |
| **Browser closure** | E1, J5 (the sweep alone), BATCH and BATCH 2 (no page open), AT 1, APH 1 | run 101 (`lv-reopen`), runs 106–107 (closed tab, fresh session), run 109 | with preparation on |
| **Clarification while unrelated work continues** | C2, P4 (a question found in preparation is asked first, at no new model cost), BATCH (one task's question; the rest finished), AT 3, AT 11 | run 107 asked (message 2, part 1); run 109's answer resumed it and placed the link on all 10 footers | a question raised by a *preparation*, live |
| **Retries and crash recovery** | P5, J1–J16, OWN 2–5, PUR 1–11, PO 1–10, BLD 3, BLD 4, BLD 6, BLD 7, APH 2, APF 4, APF 8, N5 | — (cannot be forced live without fault injection) | live |
| **Stale prepared results** | REVALIDATED, **XR**; `requestHash` and replay units (each answer used once; a different request goes live); OWN 5 and PUR 4–5 (a late owner's result never replaces a newer one) | — | how often real preparations are wasted |
| **Duplicate submissions** | I1 (the same key again), I2 (two tabs at once), I3 (every job twice), I4; OWN 1 (one preparation delivered twice at once); P6, BATCH 2, APF 5; AT 2 (a legacy post with files) | — | a real duplicate delivery on Cloudflare Queues |
| **Publishing** | one publish per part, on the pointer's etag, in its own job; J2, J3 (a mid-publish death held for review); the strict no-site-write check for every preparation; XR (the lock across requests) | runs 107 and 109 (one publish per changed part) | the lock live under two requests |
| **Charging** | `noPrepMoney` in every parallel case (no ledger row or job RPC for an unfiled job); one routing charge per message key; each job reserved once; replayed answers billed once at their recorded usage; refunds by the sweep (J1, P5) | run 109 reconciled to 4 credits; run 107 to 25 | prepared calls no job used (ours) |
| **Model-written progress** | prepared parts told as "being worked out alongside / not on the site yet" (`c06977c7`, unit); BLD 10–12 (Build lines from real steps, the resume, the sweep); APF 7 (pending photographs' facts) | run 105 (`lv-progress`) and run 107 (all eight progress checks) | lines for a prepared part, live; a first Build's live lines, live |
| **Attachments** | AT 1–12 (kept with the request, decoded whole, never a partial set) | — | — **and not consumed by the Add-on step** |

## 4. This review's one new test

The one requirement no test covered: **two separate messages, accepted as
two requests, touching the same page.** Every earlier case is one message.
`clearToPrepare` checks only its own request's earlier parts, so the second
request's step can be prepared against a page the first request is about to
change.

**XR** (`test/parallel-requests.test.mjs`, `8109aab4`), through the real
Worker, driver, consumer and site lock:
- the first message changes the home page's opening line;
- the second changes a price and the home heading. Its heading step is
  prepared at once, against the home page as it was;
- the first request's job is held inside its model call while the second
  request's job is delivered. **The site's lock defers it, and it runs
  nothing;**
- once released:
  - both requests end `done`;
  - the heading's job **asks again**, and what it is shown carries the first
    request's change;
  - **both changes are kept**, and the price changed;
  - one routing charge per message, each job reserved at most once, and
    nothing charged under an unfiled job.
- **Result**: it passes on the existing code. No blocker was found, so no
  product code changed.
- **Sweep** (`replay-ignores-request`, `busy-fails-at-once` and a
  comment-only control): **2 of 2 killed**, the control survived.
- **Focused run** on `8109aab4` (the 15 parallel, purchase, add-on-photo,
  attachment, Build-parallel and request files): **`232 / 232 / 0 / 0`**.
- **Full suite** on `8109aab4`: **`10272 / 10272 / 0 / 0`** (was 10271). A
  first run read `10272 / 10271 / 1`. The failure was
  `canary-reopen-browser` REOPEN 1, a real-browser preview timing check,
  which passes 3 of 3 runs alone; the rerun was clean (§6).
- **CI on `8109aab4`**: unit tests (run 37930813501) green, `10272 / 10231 /
  0 / 41`, the same total. The site build's last run is on `58d3350b` (run
  37926585858, green), and no product file has changed since.
- **The lock itself is the database's**; offline it is the fixture's model
  of `edit_claim`. A first mutant that skipped the consumer's claim check
  survived, because the consumer claims and defers before that code is
  reached. It was replaced by one that fails a busy job at once, which the
  case kills.

## 5. Verified, mocked-only, unsupported, live-only

- **Verified offline** (real code, supplied answers): everything in §3's
  middle column.
- **Mocked in every offline case**:
  - every model answer;
  - the image service;
  - Supabase's RPCs, including the site lock;
  - the queue and the cron;
  - the container's launch.
  Real throughout: the parser, the build service's `/frames` door (round 7)
  and Chromium for the card and page cases.
- **Unsupported**:
  - concurrent *writes* to one site;
  - a message mixing a first Build with edits;
  - preparation that accounts for another request's unapplied writes;
  - preparing the logo step;
  - preparing an add-on past its design when it needs a new database;
  - **consuming attachment contents inside an addition**;
  - provider-side idempotency for a photograph (none exists on the endpoint
    used);
  - automatic placement for a token inside a longer string, or for a job
    outside a request.
- **Needs live services**:
  - real routers' targets (which decide whether anything overlaps);
  - real overlap and timing;
  - the wasted-preparation rate;
  - the Worker's cost of preparation;
  - a real duplicate queue delivery;
  - the image service on a lost answer;
  - the `/frames` door in the new image;
  - a first Build's live lines and photograph overlap on real models.

## 6. Remaining gaps (none is a blocker found by a test)

1. **No preparation code has run live.**
2. **Overlap depends on the router's targets.** With none, a part counts as
   the whole site: it is safe, but nothing overlaps beside it.
3. **Cross-request preparation can be wasted** (XR). It is safe, and the
   cost is ours.
4. **Writes stay one at a time per site.**
5. **The image provider has no idempotency key.** A lost answer is held and
   bought again only on the customer's say-so.
6. **The full-suite run had one intermittent real-browser failure**
   (`canary-reopen-browser` REOPEN 1, a preview timing check under load). It
   passes 3 of 3 alone and is in the backlog.

## 7. The release-and-validation proposal

### 7.1 The release

- **The candidate**: the branch tip at the merge. Today that is `8109aab4`
  plus this review's records: `main` `9d6bda8a` plus 93 commits, a
  fast-forward.
- **What reaches production**:
  - `worker.js` and `public/chat.js`;
  - 30 `builder/` modules. Seven are new: `pending-frames.mjs`,
    `prepared.mjs`, `request-plan.mjs`, `rendered-menus.mjs`,
    `rendered-pictures.mjs`, `design-repair.mjs` and `attached-photos.mjs`;
  - the `Dockerfile`;
  - `.github/workflows/edit-canary.yml`.
- **What it carries**:
  - the parallel-tasks rounds 1–9: preparation, ownership, one purchase per
    picture, staged purchase outcomes, pending add-on photographs,
    Worker-run recovery, legacy posts as requests, and attachments;
  - the first-Build batches 1–9: the audit's corrections, recovery, billing,
    delivery, design recovery, photographs beside pages, fonts and
    translations beside photographs, and live lines;
  - the run-107 follow-up;
  - the menu-evidence corrections.
- **One container image build**: `335396c8c0e0fbcb` → **`6c9fc805fe4de0d8`**
  (204 inputs), predicted at `58d3350b`; `8109aab4` changed a test only. It
  is predicted again at the final candidate.
- **No secret changes.** `REQUEST_FLOW` and `PROGRESS_REPLIES` stay on. The
  way to stop new requests while accepted ones finish is still `REQUEST_FLOW`
  off and a redeploy. Preparation has no switch of its own.

### 7.2 Steps, in order

1. **Preflight** (free):
   - nothing in flight (Actions runs, edit jobs, open requests on
     `fold-lane-bakery`);
   - unit and site-build CI green on the candidate;
   - the image predicted on both ends;
   - the rollback (`git revert --no-commit 9d6bda8a..<candidate>`) giving
     back `main`'s tree in a throwaway worktree;
   - no skip-CI marker in any message;
   - the served `chat.js` read *before* the deploy.
2. **The merge**, on the owner's word: one fast-forward of `main`, which
   starts one deploy run. Read its `built` line and the image pair
   `335396c8c0e0fbcb` → `6c9fc805fe4de0d8`.
3. **Served files**: `chat.js` byte-compared with the merged file.
4. **The image window**: wait 15–20 minutes once.
5. **Runtime check**: the owner's free canary press. Both readers must
   answer the candidate's sha, a cold container must answer
   `6c9fc805fe4de0d8`, and queued jobs and the runner must be on. Nothing is
   charged.
6. **Press A**, the paid live check (§7.3), only after step 5 passes.
7. **Presses B and C**, each only on its own approval (§7.4).

**Rollback**: revert the range and push; that rolls the image back. Check
first that no request is in flight. A record written by the new code
(`uncertain`, `prep`, purchase records) is new data that the old code does
not read.

### 7.3 Press A: `lv-parallel`, on `fold-lane-bakery` (required)

**Preparation before it** (free, on the branch; it can follow the merge,
because a press runs the branch's canary):
- the scenario `lv-parallel` in `scripts/canary-ui.mjs`;
- the request trail recording each part's `prep` reading (the view already
  answers `preparing` or `prepared`);
- an overlap verdict over that trail;
- their offline tests;
- the workflow form's line;
- free reads: the focaccia's price (4b-d1 put it back at 4.5) and that no
  footer links to Instagram.

**Two messages, one press**:

> Add a link to our Instagram in the footer, make the focaccia £4.60, and change the Order page heading 'Choose your loaf and a collection time' to 'Pick your loaf and a collection time'.

> It's instagram.com/harbourloaf

**Why this order** (the gating rules of §2):
- **Part 0, the footer link**, is filed at once. Its step (the add-on, then
  the menu step, as run 107's TikTok part went) has no address, so it asks.
- **Part 1, the price** (a data step), reads only the tables. Nothing earlier
  writes a table, so its step is **prepared beside part 0's jobs**, when the
  router names part 0's targets.
- **Part 2, the heading** (a text step), reads every page. Neither earlier
  part writes a page, so it is prepared too, or at least routed.

While part 0 waits for its answer, parts 1 and 2 are applied. That shows
**clarification while unrelated work continues**, with the price job
answered from its preparation. A menu change would not do here: it reads the
menus that the footer link writes, so it could never be prepared beside part
0.

The tab is closed once the first progress line shows. The rest is followed in
a fresh browser session (`away: "fresh"`). The second message answers the
question.

**What it settles live**:
- whether the real router's targets allow overlap;
- overlap itself;
- clarification while unrelated work continues;
- browser closure, progress, publishing and charges, all with preparation
  on.

**The live row**: the focaccia price on the demo site goes 4.5 → 4.6. **It
is put back afterwards** by the existing free `4b-d1-restore` press (only
while it reads 4.6), unless the owner keeps it. That is a live row write,
named here for the approval.

**Expected cost: about 11–17 credits.** That is:
- the message's routing, 3;
- part 0: the add-on hand-over 0 and the menu step 1–2;
- part 1: routing 1–3 and the data step 1;
- part 2: routing 1–3 and the text step 2;
- the answer's routing, 1.

**Budget 20**, `fundsFirst`. **The balance is 11** (last read after run 109)
and must be raised to cover the budget before the press; the hard cap is the
balance it starts from.

**Pass** (every item):
1. One request with three parts. Every part ends `done`.
2. **Overlap**: at least one view shows part 1 or part 2 `preparing` or
   `prepared` while part 0's job is `queued` or `started`.
3. **Clarification**: part 0 is `waiting` with a model-written question
   while part 1 or part 2 is `queued`, `started` or newly `done`. The answer
   resumes part 0 with no resend of message 1.
4. **Order**: no part starts before a part it needs is done
   (`jobOrderVerdict`).
5. **Results**:
   - the focaccia reads 4.6 through the owner's and the visitor's routes;
   - `/order`'s heading is changed;
   - every footer gains the Instagram link and keeps its links;
   - every stored page is byte for byte as before apart from the named
     changes;
   - every page still answers 200.
6. **Closure**: the request finishes with the tab closed, and the fresh
   session shows every reply.
7. **Progress**: a model-written line on each running part, and no line
   calls a prepared part done.
8. **Money**:
   - one routing charge per message;
   - each job charged at most once;
   - no ledger row for an unfiled job;
   - later charges reconciled;
   - the total within budget.
9. **Publishing**: one publish per part that changed a page, chained from
   the version before. The price changes a row and publishes nothing.

**Fail and stop**:
- any wall hit (a part routed outside `text`, `data`, `nav` and the add-on's
  hand-over);
- the budget reached;
- a part `failed`, `partial` or `unverified`;
- part 0 asking no question;
- **no overlap observed**. That fails the overlap criterion, and the cause
  is read from the record: the router named no targets for part 0 (so it
  counted as the whole site), or a gate held.

The heading and the footer link stay on the site (the demo rule), as with
runs 107 and 109.

### 7.3a Press A as pressed (run 113), and its correction (2026-10-09)

- **Run 113** (run 37947640646, 14:54–15:10 UTC, on deploy 2189): the
  **workflow run failed**. One canary check failed: the progress check had
  no message sent with its tab closed to read.
- **Shown live**: the three changes, the clarification while the price and
  heading finished, the replies, and 12 credits reconciled to the ledger.
- **Concurrency is unverified.** Pass item 2 above was judged by status
  sampling (`preparing` or `prepared` beside `queued`), which Codex showed
  passes with nothing running at once. Run 113's job rows are strictly
  sequential, and no record shows when a preparation's step ran
  (`docs/history/2026-10-09-run113.md`).
- **Corrected on the branch** (`docs/history/2026-10-09-overlap-intervals.md`).
  - **Item 2 is now judged by recorded intervals**: a part's prepared step
    (its own interval and model calls) must intersect another part's job
    execution (its progress record's opening to its close).
  - **Routing alone, a queued job, sequential runs and missing records all
    fail.**
  - **Item 6**: the answer is sent with its tab closed and followed in a
    fresh browser session, and the progress checks are restored.
  - **The live row**: the focaccia's new price is **kept**. No automatic
    restoration of demo data.
  - The interval fields are product code (`builder/request.mjs`,
    `worker.js`), so they need a deploy before a press can read them.

### 7.4 Optional presses, each on its own approval

- **Press B: an add-on with a photograph** (round 7's check):
  - *"add a gallery page with one photo of the workshop bench"*, expected
    route `addon`;
  - one photograph bought and placed, one publish, the part run in the
    container (its trace's `where`), charged once;
  - **about 22–34 credits**: the add-on 2–13, plus a photograph at about 19
    (`IMAGE_USD` 0.15 at $0.008 a credit).
  - It covers the add-on's purchase record live. The pending path (a store
    failure, a late purchase) stays offline-only.
- **Press C: one first Build** on a new throwaway slug:
  - one page and at most 15 components, unchanged;
  - it covers photographs beside the page writing, fonts and translations,
    model-written live lines and the build's reply;
  - **about 11–45 credits** (measured first builds), plus about 19 per
    photograph the design asks for.

### 7.5 What stays unverified even after press A

- crash recovery, lost purchases and duplicate deliveries (offline only);
- cross-request preparation (offline only, XR);
- the Add-on consuming attachment contents (not implemented);
- concurrent writes (unsupported).
