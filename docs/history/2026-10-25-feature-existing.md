# 2026-10-25 — a feature added to a page the site already has (branch `fix-feature-existing`)

From `origin/main` `b12dba52c`. Not merged, not deployed. No model calls, no live writes, nothing spent.

## The live failure

2026-10-25 01:37 UTC, `driftwood-and-daughters-5`, after deploy `b12dba52c`. The customer asked for the
existing Lessons page to have "each [lesson] bookable online with date, time and number of people, max 8
per group lesson, and a switch so I can mark a day closed for bad weather". `addon-existing`
(`builder/addon-existing.mjs`) read the router's `addon` answer as touching only things the site already
has (the page `/lessons`; the site already stores `lessons`, `lesson_bookings`, `closed_days`, read from
the route jobs' `tablesFilled`) and sent it to the page step. The page step changed the page's words and
built no booking (job `64b9099a…`, `pageOps [/lessons]`); the reply said "Lessons still needs online
booking…". The sibling route jobs that morning show the same shape (`page:/board-shop` + existing tables,
`page:/cafe` + `data:menu_items`), all rewritten to `edit`/`page` with reason `addon-existing`. The Lessons
part was routed inline, so its own targets are not in `edit_jobs`.

## The home, and the rule

The add-on step already builds features on existing pages: `component` is "a new component on a page the
site already has" (a form, a section), `table` stores what the feature remembers, `function` holds a rule.
What was missing was the routing distinction, now made from the router's own targets, never words:

- **`addonOnExisting` returns `{ act: "feature", page }`** when change 0 writes a page the site has and
  also creates something beside it: `new-component:`, `new-data:`, `new-function:`, `new-api:` or
  `new-job:`, or writes a `data:` table the site does not have. Checked before the all-existing rule.
- **`routeOnExisting` keeps it an add-on** and attaches a hand-over `{ from: "route", reason:
  "feature-on-page", field: "component", page }` (never over one already there). `feature-on-page` is in
  `HAND_REASONS`, so `readHandOver` keeps it and the picker is shown its line ("build it on that page").
- **The add-on step** (worker.js, after `aOnPage`): with that hand-over, an empty pick is never handed
  back to the page step (it ends `no-add` honestly), and a lone `row` (the earlier failure: lesson rows
  inserted) becomes `component` on that page.
- **The router is told** (the `targets` description, `builder/site-ask.mjs`): a form, section or working
  feature added to an existing page names what it creates beside `page:/path` (`new-component:Name`,
  `new-data:table`, `data:table`); `page:/path` alone means only that page's content changes.

Content-only answers (`page:/x`, with or without existing tables) still go to the page step.

## Limits

- The live request depends on the router naming `new-component:` for it; that is a prompt change, not
  shown with a real model (no model calls in this round). An answer that names only `page:/lessons` and
  existing tables is still the page step's.
- The max-8 rule and the closed-day switch are whatever the add-on's `table`/`component`/`function`
  designers make of them (RLS via `resolveAccess`, checks where the table designer writes them); nothing
  new was added to those designers here.

## Evidence

- Tests: `test/feature-existing.test.mjs` (5 cases); `test/addon-existing.test.mjs` updated in two
  places (a `new-data` beside `/shop` is now `feature`; the no-add landmark).
- Red check: with the source reverted, the new file is 1 pass / 4 fail (the content-only control passes).
- Sweep: 9 of 9 mutants killed, the comment-only control survived.
- Full suite `node --test "test/*.test.mjs"`: 12,773 tests, 12,767 pass, 3 fail, 3 skipped. Two of the
  failures were guards on the changed lines (`test/site-add.test.mjs`'s empty-picker landmark,
  `test/handover-batch2.test.mjs`'s producer list, which now reads `feature-on-page` off
  `builder/addon-existing.mjs`); both updated and green (74/74). The third,
  `test/no-generated-deps.test.mjs`, failed only because the worktree had `node_modules` symlinked in;
  without the link it passes (2/2).
