# 2026-10-24 — add-ons about what already exists (branch `fix-addon-existing`, from `main` 7956740c4; not merged, not deployed)

No model calls, no live writes. Nothing spent.

## 1. What went wrong live (traced from `edit_jobs` / `edit_traces` at 7956740c4)

1. The router answered `addon` for parts whose targets already exist (`page:/shop`, `page:/cafe`, `data:lessons`).
   - (a) "Add a bookable Lessons page…" was picked as a lone `row`; the add-on wrote a partial `lessons` entry and Postgres refused it (23502 `not_null_violation`, "the database didn't accept it"). Neither `rowBrief` nor `cleanAdd`'s `row` case knew the list's NOT NULL columns.
   - (b) An empty pick ended as `no-add` (or the requirement judge put everything elsewhere / already there): nothing done, routing charged, nothing handed to the edit step.
2. A part of an already-charged request could still be answered `clarify`, and the answer resumed the same request and paid routing again.

## 2. What changed

- **`builder/addon-existing.mjs`** (new, pure; added to the Dockerfile's worker tree — `test/dockerfile.test.mjs` caught it):
  - `addonOnExisting` / `routeOnExisting`: an `addon` answer whose change-0 writes are all pages or lists the site already has, at least one a page, becomes `edit` / `page` on that page, same words, decision code `addon-existing`. One that writes a page (new or existing) keeps `addon` and carries the hand-over `{ from: "route", reason: "page-asked", field: "page", page? }` (never over an existing hand-over). Reads only the router's typed targets and the site's page/table lists.
  - `partClarifyChoice`: a `clarify` becomes the obvious choice (a page the change names and the site has → page step; else `addon`); the start-over confirmation is never converted. **Written and tested, not wired** (§4).
- **worker.js, routing**: `routeOnExisting` runs on every non-failed answer before the preparation return, so a part's preparation and its job agree.
- **worker.js, routing charge**: an answer resuming a part of a paid request (`rWaiting.requestKey`) is not charged routing again (`rPaidResume`).
- **worker.js, add-on step**: with a known page the site has (the hand-over's page, or the part's one scoped page), an empty pick hands the part to the page step on that page (`addonFailure("existing", { layer: "page", page })`, cost 0) instead of `no-add`; a `page-asked` part picked as a lone `row` goes to that page, or, with no existing page, runs as a `page` addition — never the single-entry path.
- **NOT NULL**: `rowRequired(spec)` (NOT NULL / `required`, no default, not `id`/`created_at`/pk) is shown to the row designer (`rowBrief(lists, required)`: "must fill: …") and `cleanAdd`'s `row` case refuses an entry missing one (`row-missing-required`) before anything is charged or written; the existing 422 path says so, cost 0.
- Fixed lists: `ROUTE_REASONS` + `addon-existing`, `clarify-part`; `HAND_REASONS` + `page-asked`, `existing`; `addonFailure` allows only `existing` → `page` with a page.

## 3. Tests

- `test/addon-existing.test.mjs`: 12 cases (the readers, the conversion, the hand-over, the clarify choice, required columns, `cleanAdd`, the hop through `readRun`/`handOff`, and three worker wiring guards).
- Red check: on 7956740c4's product files (the new module kept), 9 of 12 fail; the 3 that pass test only the new module.
- Sweep: 15 mutants, 15 killed (14 after the clarify wiring was withdrawn, 14 of 14); the comment-only control survived.
- Updated to the new behavior: `handover-batch2` (census reads the two new producers), `route-decision` (the two codes are the route's), `site-add` (the empty-pick landmark), `request-flow` C1 and CR 1/CR 2 (the answer's routing is no longer charged: one routing row, not two).
- Full suite (worktree): `12718 / 12713 / 2 / 3`. The 2: `container-room` (this worktree has no `node_modules/@cloudflare/containers` build) and `canary-reopen-browser` REOPEN 1 (passes alone, 2/2; load-flaky).

## 4. Left open

- **No question after charging, at routing.** Wiring `partClarifyChoice` broke 12 request-flow scenarios built on a part's routing asking (C1, C3, C5, CR 2, D2, E2, I4, F3, SV, PAGE 3, DFU4, RC 6). Rewriting them changes what they prove, so it is the owner's call; the function and its tests are ready.
- **The judge's "all elsewhere / already there" ending** is covered only where the router's targets show everything exists (converted before the add-on runs) or the pick is empty; a judge deciding so after design still ends as before.
- **Routing refund on "nothing done"**: the add-on's own refusals stay cost 0; the routing charge already taken is not refunded (no refund path for routing exists).
- A `page-asked` lone `row` with no existing page becomes `page` alone: "bookable" detail is left to the page designer.
- The container image will rebuild (Dockerfile and builder inputs changed); not predicted here.
