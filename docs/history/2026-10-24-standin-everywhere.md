# 2026-10-24 — the stand-in on every path (branch `standin-everywhere`, not merged, not deployed)

The owner: "use it everywhere … I don't think it should fail, but use it
everywhere". Branch from `origin/repair-everywhere` (`a17d8fc8c`, on `main`
`692087cde`). Nothing spent, no model called, nothing live written: every
model answer and every compile in the tests is a stub.

## 1. Before

On `repair-everywhere`, a first build or revise whose part still failed after
compile repair was salvaged (`partStandIn`, `salvagedParts` → `standIn`).
Every edit and add-on (the shared seam `recompileAndPublish`, the add-on's own
`compileRepairRounds` hook) **refused the whole change** when repair failed.

## 2. What changed

- **`builder/change-salvage.mjs`** (new, pure; added to the Dockerfile's
  worker COPY line):
  - `salvageRound`: for each file the compiler cites that the change MOVED
    (differs from the stored source): a file the site already had goes back
    to its stored version (`kept`); a new part becomes `partStandIn` (keeps
    every export, draws nothing); a new page becomes `pageStandIn`. A cited
    file the change did not move is not salvaged (not this change's fault);
    an unreadable store salvages nothing.
  - `pageStandIn`: a valid route for the page's path (`routeIdFor`), the
    site's own `SiteHeader`/`SiteFooter` (default exports at `-parts/`) when
    it has them, and an empty `<main id="main">`. No words of ours.
  - `anythingLanded`: whether any page or part still differs from the store
    once kept and standing-in files are left out.
- **`worker.js` `recompileAndPublish`**, after the repair hook (the seam's own
  or the add-on's) and before the refusal: only for a failure of the CODE (not
  killed, timed out or out of room), never on a rename. Reads the stored pages
  and parts (`readSiteSource`, `readSiteParts`; an unreadable store skips with
  `salvage skip no-stored`), then up to `MAX_SALVAGE_ROUNDS` (3) rounds of
  salvage + recompile. Compiles → published with the salvaged lists; a
  restored part is saved (`partsRepaired`). Still failing, or nothing left
  that landed → the lists are put back and the change is **refused as
  before**: broken code is never published.
  - Steps: `salvage round` (kept/standIn counts), `salvaged ok` with the
    `kept` and `standIn` lists, `salvage fail`, `salvage skip`.
  - Progress: `salvaged` with `salvageFacts` (builder/site-progress.mjs).
  - The publish answer carries `salvaged: { kept, standIn }`; the edit route's
    final body and the add-on's body pass it on.
- **Reply facts**: `salvageFact` (builder/site-reply.mjs) in `editReplyFacts`
  and `addonReplyFacts`: the file kept as it was and the new part standing in,
  and that they can ask again. Facts for the model writer, not a reply.
- **Charging**: the salvage makes no model call, so it costs nothing; a
  repair round that did not fix is not charged (existing rule); a change with
  nothing left that landed is refused, so the existing refusal path refunds.
  **Not done (needs an owner decision)**: a writer's reserve placed before the
  compile (the page rung's, the add-on writer's) is not refunded per file
  that was kept or stands in; the tests show the bill equals the same change
  compiling clean.
- **Not changed**: the build path (already salvages); restore (no compile);
  a renamed page (salvage skipped, refused as before); a kit site's new page
  stand-in has no header/footer (only an empty main), because its frame is
  `SiteChrome` with props.

## 3. Tests

`test/standin-everywhere.test.mjs`, 8 cases: the round's three rules; what is
not salvage; the facts (reply and progress); through the real
`POST /api/site/<slug>/edit` with a stub compiler that judges what it is sent
(an edit that breaks the stored band: band put back, the home change
published and stored, `salvaged` on the body, reply facts name the band, bill
equal to the clean change); still broken → refused, nothing stored; only the
broken page changed → refused; through the real add-on route (a new page that
will not compile stands in with header and footer, the other new page and the
home link publish, reply facts, bill equal to the clean addition); still
broken → refused; a placement guard. Fixtures: `installCompiler({ judge })`,
`addon(..., { compileJudge })`.

- **Red check** against `origin/repair-everywhere` (new module copied in so the
  pure cases load, missing exports stubbed): 4 of 8 fail (the edit, the
  add-on, the facts and the guard); the two pure cases and the two refusal
  cases pass on both (refusal is the old behaviour).
- **Sweep**: see §4.
- **Full suite**: see §4.

## 4. Readings

(stamped after the runs)
