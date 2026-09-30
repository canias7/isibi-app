# 2026-09-30 — Test 10 prepared: what controls a list's order, and the path that changes it

Prepared on the owner's word after Test 9 was closed. **Free preparation
only; nothing was pressed, spent or written.** The plan, the decision and the
acceptance are in the checklist's *Test 10*. This file keeps the readings and
the rehearsals behind them.

## 1. What was asked

> Next, prepare one list-reordering acceptance on an existing demo site.
> First trace what controls its order: a stored ordering field, a database
> query, or page code. Establish the supported edit path and choose a request
> that visibly changes the order. Don't assume every reordering belongs to the
> data layer or change routing policy merely to make the test pass. Provide
> the exact request, expected route and changes, checks that unrelated
> content stays unchanged, and credit estimate. If a product decision is
> genuinely required, explain that specific decision with your
> recommendation.

## 2. What controls the order: page code

A generated page reads a list with `useRows("<table>", { order, dir })`. The
template's `pgQuery` (`builder/lovable/template/src/lib/rows.ts`) sets the
Data API's `order` to `<order ?? "id">.<dir === "asc" ? "asc" : "desc">`, so
Postgres sorts by whatever the page names. `builder/site-order.mjs` says the
rest: the database has no opinion, and the schema's `defaultSort` is acted on
by nothing.

Read from the stored sources (the bakery's and `fretwork-1`'s from the latest
canary evidence, `lido-axes-b`'s from run 44's):
- **`fold-lane-bakery`**: `order.tsx`, `useRows<Loaf>("loaves", { order:
  "name", dir: "asc" })`, drawn as a one-column list of cards (name, then
  "£price · description"). No other page reads a list.
- **`fretwork-1`**: `index.tsx` and `prices.tsx`, `useRows<Lesson>("lessons",
  { order: "price", dir: "asc" })`; `index.tsx` also
  `usePublicRows<PublicBooking>("bookings", { order: "appointment_date", dir:
  "asc", limit: 100 })`.
- **`lido-axes-b`**: `index.tsx` and `menu.tsx`, `useRows<MenuItem>
  ("menu_items", { order: "name", dir: "asc" })`, then `groupMenu`, which
  buckets the items by category and lays the buckets out in a
  `SECTION_ORDER` constant declared on each page; the home page takes two per
  category.

**Live on the bakery, read-only (22:42–22:51 UTC):**
- `loaves`, read whole as a visitor: `0-5/6`, 1,045 bytes, sha256
  `ef870ebcf8353634…`; columns `id`, `name`, `description`, `price`,
  `photo`, `created_at`; six distinct prices (4.5 to 6).
- `/order` in a headless browser at `8btpep`: its one data request is
  `loaves?select=*&order=name.asc`, and the cards read Country White, Dark
  Rye, Olive & Rosemary, Sea Salt Focaccia, Seeded Wholemeal, Walnut Levain.
- `/`, `/starter`, `/visit`, `/gallery` and `/order` answer 200 at
  `01790468089054-8btpep`; `/the-starter` answers 301 to `/starter`. The
  HTML declares `lang="en"` and no `hreflang`, so a publish there has nothing
  to translate.

## 3. The paths that can change it, and the router

- **The data rung's sort lane** (`DATA_TOOL.order`, `readSortChange`,
  `applySort`). The picker is shown every list with its current order and
  its columns. It may answer one table, one column and a direction. The lane
  rewrites every `useRows` call for that table and hands the pages to the
  publish (worker.js: *"A REORDER IS THE ONE THING THIS LANE PUBLISHES"*).
  The publish is not charged; the picker's call is. A column the list lacks
  and a computed options object are refused. A hand-picked sequence is out of
  scope by design: the tool tells the picker to leave it out.
- **The `page` rung**: one file, rewritten by the quick writer (`runTweak`)
  or the full writer. `orderingMoved` reports other pages showing a list
  whose order it changed, and never rewrites them.
- **The router** (`builder/site-ask.mjs`) has no clause for a list's order.
  `data` names rows; `page` names *"lay a list out differently"* on one page;
  `nav` names the menu's order. The look door has no lane for a list's sort.

## 4. Rehearsed free, with supplied answers (scratch, not committed)

The scripts are in the session's scratch directory
(`reorder/rehearse.mjs`, `reorder/route-rehearsal.test.mjs`,
`reorder/order-preview.mjs`, `reorder/pxdiff.mjs`).
- **The lane, module level** (`runDataEdit` on the stored `8btpep` pages and
  the live rows):
  - `order: {table: "loaves", column: "price", dir: "asc"}` changes exactly
    `order.tsx` line 97, from `{ order: "name", dir: "asc" }` to
    `{ order: "price", dir: "asc" }`; the other four pages are untouched; no
    row is written; *"✅ loaves now comes out in order of price, lowest first —
    on 1 page."*;
  - `dir: "desc"` writes the same line with `desc` and "highest first";
  - a hand-picked sequence (no `order`) ends `no-match`;
  - a missing column: *"loaves has nothing called popularity. It has name,
    description, price, photo — say which of those to order by."*;
  - the order it already has: *"loaves already comes out in that order —
    nothing to change."*
- **The real edit route** (`test/edit-failure.test.mjs`'s harness, copied;
  the synchronous path; the `sonnet` transport, because the harness answers
  the Messages API):
  - status 200, `layer` `data`, `sort` as supplied, `sortChanged`
    `["order.tsx"]`, `applied` `[]`, cost 1;
  - one model call (`write_row_changes`), one debit of 1, one compile, one
    publish upload;
  - no UPDATE, INSERT or DELETE in the SQL it sent;
  - the stored `order.tsx` differs in line 97 alone; the other four pages are
    byte-identical;
  - the browser's own handler: *"✅ loaves now comes out in order of price,
    lowest first — on 1 page."*, then a balance refresh.
- **A preview of what a visitor would see**: the live `/order`, read-only,
  with the page's own data request rewritten in the browser from
  `order=name.asc` to `order=price.asc`, which is all the one line changes.
  The cards read Sea Salt Focaccia £4.50, Country White £4.80, Dark Rye
  £5.20, Seeded Wholemeal £5.40, Olive & Rosemary £5.80, Walnut Levain
  £6.00. Against the live page, 19,227 pixels differ, all inside the box
  369,354–807,672 of 1280×1400 (the first five cards); the rest is
  identical.

## 5. The decision, and why the test waits on it

The expected route is part of the acceptance, and the router has no rule
that sends a sort to the lane built for it. So the acceptance waits on
decision 2b. The recommendation is `data` for a sort by something the
entries have, with one router clause (lane 3), and it is argued in the
checklist's *Test 10*, with the alternatives. Nothing was changed in the
router, and the request was not worded to steer it.

## 6. Found on the way (backlog)

- A hand-picked order is told *"I couldn't match that to anything the site
  stores"*, which is false and gives no next step.
- No route test drives a successful sort to its publish; the one route case
  is a sort whose publish fails.
