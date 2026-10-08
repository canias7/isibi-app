# The first Build correction batch (2026-10-08)

**Branch only: not merged, not deployed, no image built, no paid call, no live
retest.** Base `8ac4a235` (Codex reviewed it, passed 11 focused checks, with
unit CI green; that round, the continuation's accounting, is closed). The
audit is `docs/investigations/first-build-audit-2026-10-08.md` (reviewed code
`e2dc4039`, byte-identical in product code at `8ac4a235`), corrected the same
day: `site-builds.mjs` is at the repository root, and H1 is qualified (§1).

Every finding below was first reproduced through its route or shared boundary
with supplied model answers and controlled failures, and the reproductions are
committed: `test/build-audit-batch.test.mjs` (39 cases) with its route
fixture `test/fixtures/build-route.mjs`, and one driven salvage case in
`test/publish-pages.test.mjs`.

## 1. H1 — a lost build: what it kept, what it published, what comes back

**Qualified.** `LOST_SITE_MSG` said *"You weren't charged for the pages"* —
true of the pages debit and silent about the rest. It did not say nothing was
charged.

**What a lost build has already taken.** Every build's ledger refs are
`build:<job>:deposit`, `:settle` and `:pages`.
- The deposit is taken at the gate.
- The settle trues the design call (and a seed top-up) up against the
  deposit, once the design answered.
- The pages debit is taken only by a publish at a charged stage.

So a build lost after its design call had kept its deposit and settlement.
The SQL sweep (`edit_sweep_lost` → `edit_refund`) moves nothing for a build
row: such rows are billed `external`, and `scripts/edit-rpc-check.sql` FAIL 77
pins that.

**What it had published.** The row never records a publish, and neither the
build's pointer nor its manifest names the job, so the row alone cannot tell.
The pointer `current/<slug>.json` can:
- none, or a pointer older than the row: nothing of this attempt is live;
- a pointer activated after the row was created: the site went live;
- unreadable: unknown.

A lost row does not prove nothing published either. The queue consumer's own
build is not fenced by the lease, so a build whose heartbeat stopped can
still publish.

**The policy, the collector's own.** Where nothing real published, the build
is reversed by ref (`refundBuildByRef`, every step). Where the site published,
what it charged stands. Where the evidence cannot be read, nothing moves and
nothing is claimed.

**The fix.** `reconcileLostBuilds` in `worker.js` is run by `runLostEditJobs`
after the SQL sweep on every tick. It:
- reads the last day's lost build rows with the service key;
- decides each with `lostBuildVerdict` (`builder/build-lease.mjs`), off the
  uncached pointer;
- reverses by ref when nothing published;
- writes the answer where the build's own would go (`resultKey`), so it wins
  at both readers. The sentence comes from the outcome (`lostBuildMessage`):
  the credits returned, or that the return is still being retried, or that
  the site is live.

The row's own sentence no longer makes a money claim. It says the charge is
being checked and anything taken for a site that did not get built is
returned automatically.

**Idempotent.** `credit_reverse` is bounded by each ref's debit and answers a
repeat of (ref, reason) with nothing more, and the reconcile never debits. A
marker beside the job (`jobs/<id>.lost.json`) records what was settled, so a
collected answer is not rewritten as "nothing returned". A short reversal
leaves the marker open; the next pass retries it and adds what it returned.

**Tests** (8): never published (three refs reversed, 6 credits, the answer);
run again (nothing more, no new answer); published (nothing reversed, "did go
live"); an older pointer (refunded); an unreadable pointer (nothing moves,
nothing written); a short reversal finished by a later pass, with a third
pass moving nothing; a first build with no address (410, refunded); the
sweep's order.

## 2. H2 — background billing without the expiring token

The queued job stored the customer's bearer and presented it for every ledger
call, and the consumer re-authenticated with it. A job that waited, or a
build that outlived the token's hour, met an expired one: `authUser` failed,
the settle debit failed silently, the balance read threw, and the pages debit
failed (the site published free).

**The fix, the existing trust boundary.**
- **The consumer.** When the stored bearer is refused, the lease holder
  vouches. `buildJobOwner` reads the build row with the service key and
  answers its uid only when the row is a build and names the same account the
  job was filed with. Nothing a request carries reaches this.
- **The ledger** (`buildLedger`). The bearer is still asked first, so every
  live token bills exactly as before. Only when the ledger refuses it (401 or
  403) does a build with its job id, service key and mint key debit through
  the proposed `build_debit`. That function bills only the row's own account,
  for the row's own three refs, while the row is not lost, failed or
  cancelled, under the same ref so the repeat check stops a double charge. A
  timeout or a 5xx is never handed on (it may have landed: L10).
- **The balance read** falls back to the account's own read only when the
  bearer's read fails.

**Not applied.** `supabase/proposed/build_debit.sql` needs your word to apply.
Until then PostgREST answers 404 and the bearer's own refusal is what the
caller sees, as before. A container-run build is not admitted to
`build_debit` by the gateway wall (named as the Worker's own in
`test/sb-gateway.test.mjs`).

**Tests** (5): the refused bearer → `build_debit` (same ref, mint, no
customer token); a live bearer bills as before; 404 leaves the refusal; a 504
is not charged a second way; a `build_debit` 500 throws; the SQL's guards;
the consumer with an expired token runs as the row's account (it reaches the
build's own 501), and a row naming another account vouches for nobody (401).

## 3. H4 — missing design output against a valid frontend-only design

No tool call, unparseable arguments and an incomplete split design all reach
the route as `null`. A first build went on with an all-null look: a random
`site-xxxxxx` brand, no theme and no layout. "No tables" could not tell that
apart from a valid frontend-only design.

**The fix.** `designUsable` (`builder/site-plan.mjs`) requires a name, a
purpose and a page with a path, and judges nothing about the database. A
first build without one stops right after the design call, before the seed
top-up, the settlement, provisioning and the page writer. The deposit comes
back through the design-failure path, and the reply names what was missing
(`unusable`).

**Tests** (4): no tool call (503, deposit reversed for `design`, no other
model call, nothing stored, no database); no page or purpose (named); the
control, a valid frontend-only design with no tables, builds; the pure
judgement.

## 4. H3, H6, M7 — attachments, photographs and refires

**H3.** `mergeLook` fell back to the request body for every look field, and
the body's `images` is the files the customer attached. A design that left
the photo plan out stored the raw attachments (data urls) as `look.images`.
The browser's empty list stored "this site has no photographs", which zeroed
the photo budget.

The fix: the body's `images` is never read as a look (`BODY_NOT_LOOK`), on
every caller.

**H6.** No attached photograph was ever stored, so "use my photo" had nothing
a writer could place.

The fix keeps reference and material apart by the model's judgement:
- the designer is told the attached files by name and that an image is
  reference unless the customer asked for it to be shown;
- an `images` entry may name a file (`attached`). Code checks the name
  against what was really attached and stores that file as an owner upload
  (the same `handleUpload`: content-hashed, sniffed, capped). It then sets
  the entry's `src`, which the plan keeps only in the upload store's url
  shape;
- the page writer is handed the src to copy, apart from the photographs to be
  bought. A customer's own photograph costs nothing, survives a zero budget,
  and never makes the zero form say "none on this site";
- a name that matches nothing, or a file the store refuses, is told in the
  reply and never bought. A reference image is never stored;
- the reply's sentence follows the outcome: stored and handed to the pages;
  saved for pages still being written; or saved for the next build.

**M7.** A refire wrote the pages again with `attachments: []`, and nothing in
R2 still held the files.

The fix keeps them beside the resume record (`jobs/<id>.attachments.json`),
with the count on the record. A refire reads them back, and the trace says
how many were sent and how many came back. Every delete of the record
deletes them too.

**Tests** (10, plus 1 for M7's wiring): H3 through the route twice and the
merge on every caller; H6 stored and pointed at, an unmatched name told, a
reference not stored, the writer's directive and budget, placement once per
file; M7 through the resumed collector on a refire (the files are read back,
and the trace records sent 1 and back 1).

## 5. H5 — editable source, parts, kit and the version marker

Each save answered `false` on a failed write, and the marker was written
anyway. The next edit then read the old pages as current and published them
over the change.

**The fix.**
- Both publish paths keep each save's answer and write the marker only when
  source, parts and kit all landed (`editableStored` on the result). Otherwise
  the marker stays behind and the next job repairs from that version's own
  state.
- A version now keeps its kit in that state too (`state/kit.json`), and a
  repair and a restore put it back.
- Every reader that goes on to publish asks for the checked source and stops
  when it is not the live version's: the revise anchor, the platform
  rebuild, the owner's text editor and "Back online". The unchecked fallback
  used to read the stale copy.
- A revise that cannot confirm its pages stops before writing any (`stage:
  "source"`, refunded as our fault).

**Tests** (5, plus the existing guards re-anchored): the kit staged, read and
repaired; both publish paths' marker gate; the text route over a marker
behind the pointer (repaired, the new words) and over one that cannot be
repaired (503 `source-unconfirmed`, never the stale words); every publishing
reader checked. The census of bare reads moved 9 → 7.

## 6. M1 — salvage on the container's real failure contract

The container stopped sending `stage: "typecheck"` on 2026-08-30: the
typecheck only reports, and only vite refuses. Salvage waited for
`typecheck`, so one page that did not bundle took the whole site.

**The fix.**
- `salvageable` asks the real contract: a `build` failure that cites one of
  the build's own files.
- `errorCitations` reads tsc's, esbuild's, rollup's and the resolver's forms,
  and cuts paths back to `src/`.
- A route-tree failure, a build that ran out of room and an unreachable
  service are never stubbed; neither is a killed step or a missing bundle,
  which cite nothing.
- Kit files, the home page and pages already live are still refused.
- The service header now says what it sends.

**Tests** (4 in the batch, plus 2 in `publish-pages.test.mjs`). The old "a
bundler failure is never salvaged" case asserted the defect with a fake
tsc-style citation; it was converted to real infrastructure forms, and a
driven case shows one page that did not bundle costing one page (three
compiles, the stub stored, the missing section told).

## 7. L10 — debits whose answer was lost

- A deposit whose call failed is reversed by ref, whatever happened to it.
- A settlement whose answer was lost is remembered and reversed by ref by any
  later refusal.
- The pages ref is reversed by ref on an our-fault exit.
- A by-ref reversal that cannot be made reads as short, never as nothing
  owed.

**Tests** (2) through the route.

## 8. Checks

- **Red check** (the batch file over `8ac4a235`'s code, with the new names as
  absent imports): **36 of 39 fail**. The 3 that pass are exactly the
  controls (a valid frontend-only design builds, a reference image is not
  stored, a row naming another account vouches for nobody).
- **Mutation sweep** (`scripts/mutants/build-batch-2026-10-08.json`, over the
  batch file and `publish-pages.test.mjs`): **33 of 33 killed, 2 comment-only
  controls survived.** The first pass had one survivor, a separate
  `wasKilled` check in `salvageable`. It was equivalent: a killed step prints
  nothing and so cites no page. It was removed, its mutant replaced by "a
  citation-free failure salvaged" (killed), and the M1 part re-swept: 4 of 4,
  control survived.
- **Existing tests re-anchored, with reasons in place**: 52 failed first.
  - Real regressions found and fixed: a balance read by account where the
    token read had worked; a debit path that changed live-token behaviour;
    the Dockerfile's worker tree.
  - Pins on the old spellings, updated: design brief, signatures, refund
    lines, kit and parts saves, the lost sentence.
  - The scope-hook test's design answer had no pages; it was given one.
  - The defect-asserting salvage case was converted (§6).
- **Full suite** on `c7aaf1e5`: `9959 / 9959 / 0 / 0` locally. **Required CI green on `c7aaf1e5`**: unit tests run 37730110015 (`9959 / 9937 / 0 / 22`, the totals match) and site build run 37730110049 (8 of 8 jobs).
- **The next image, predicted** (not built): `f39e59b4bdb7ec77`, 198 inputs (the branch's previous prediction `59059c19e7c883fd`, 197; production `335396c8c0e0fbcb`).

## 9. Limits that remain

- **`build_debit` is proposed SQL, not applied.** Until it is, an expired
  bearer's debit fails as it always did. The consumer then runs (vouched),
  refuses at the deposit, and gives it back by ref.
- **A container-run build** is not admitted to `build_debit` at the gateway.
- **A build that publishes after it was reconciled lost** (the consumer's
  build is not fenced by the lease) is refunded, and the customer is
  favoured — unless its bearer is still alive, when its pages debit lands on
  the token path after the refund. `build_debit`'s refusal of a lost row
  applies only when the bearer was refused.
- **`lostBuildVerdict` reads a pointer activated after the row began as this
  build's publish.** A later edit to the same site within the reconcile's
  window would read the same way.
- **An unknown outcome past the one-day window** keeps the row's neutral
  sentence and moves no money.
- **The page writer is handed the customer's photograph**, and the reply
  cannot see whether it placed it. The stray sweep keeps the src only because
  the file exists.
- **The designer must name the file.** A real model's use of `attached` is
  not measured (no paid call).
- **A pages debit whose answer was lost on a charged stage** still reads as
  nothing taken in the reply (the ref is reversed only on an our-fault exit).
- **The build's replies stay composed in code** (`notes`, `contextNote`),
  as before this batch. The facts now come from the outcome; model-written
  build replies are not in this batch.
