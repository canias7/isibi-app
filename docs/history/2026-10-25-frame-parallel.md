# 2026-10-25: the frame's sign-up, and parts on one page (branch `fix-frame-parallel`)

From `origin/main` `b12dba52c`. Not merged, not deployed. Nothing spent: every model answer in the
tests is supplied. Evidence was read from Supabase (`edit_jobs`, `edit_traces`, non-secret columns
only).

## 1. What the evidence shows (driftwood-and-daughters-5, 2026-10-25 01:37–01:50 UTC)

One message ("Now let's build out the rest… Add a Lessons page… Board shop… Cafe… Hire… Events…
Gallery, FAQ, Contact… Put Instagram and Facebook links and a newsletter sign-up in the footer, and a
header menu linking every page… home page changes") became a request of parts.

- `64b9099a` (part 0, `/lessons`, done, cost 15); route jobs `e8cd32f9` (`/board-shop`, 5),
  `9e542a95` (`/cafe`, 3), `12110ccf` (`/hire`, 4); run jobs `722524f1` (13), `b12899f9` (15),
  `941a4ea0` (17), the last three cancelled before publishing.
- **Every one of those pages already existed** (the first build made them). The router answered
  `addon` each time; `routeOnExisting` (addon-existing) turned each into the page step on that page.
- **The page writer answered each page unchanged** (trace `retry_reason {step: page, reason:
  no-change}` on three of the four traces): the page already did what was asked. The no-change retry
  ("answer with the page, whole, with that change made") then pushed it into a whole-page rewrite,
  plus a visual review (2–3) and a translation (1–2). That is the 12–17 credits per part, four at once
  because the parts were on four different pages (`writeMax`).
- No part was a whole-site rebuild (each publish stages the site's 53 files, as every publish does).
  No two parts in this run landed on the same page; but parts that do were each a separate whole-page
  rewrite of it, run one after the other (`clearToWrite` holds the second until the first ends).
- **The header/footer part never ran in this window**: the request was cancelled before its turn, and
  there is no frame job or trace after 01:30. The refusal the customer saw is job `75f25f2f`
  (2026-10-24 21:03, before main had the frame rules and the retry): `refused`,
  `problems: ["footer:kit:@/components/ui/figure"]`, no retry.

## 2. Root causes and fixes

**Frame (header/footer).** Main already names the allowed kit modules and retries once. What was still
missing for "a newsletter sign-up in the footer": the frame call was never told the site's tables, and
its only instruction was "a plain <form>". A sign-up could store nothing, or name a table nobody
checked. The frame's files may import `@/lib/rows` (only the kit is refused), so the frame path can
wire a form to a table.
- `builder/site-frame.mjs`: `frameTables(spec)` lists the tables a visitor may write
  (`resolveAccess(t).write === "anyone"`, not retired, managed columns left out), sent in the request
  as "TABLES A FORM HERE MAY STORE INTO" (or "None", which tells the model to answer `cannot` for such
  a form). The rules say how to store into one: `useCreateRow("<table>")` with only its columns. Spam
  protection is added by the site's root (`spam-guard.tsx`). The check refuses a frame naming any
  table that is not listed, or any read hook (`table:<name>`). A hook the stored file already had is
  not judged again. The one retry carries the reason.
- `worker.js`: `frameTablesOf(env, slug)` reads the schema the catalog-aware way (`specForAddon`),
  read only, never throws (`[]` when it can't be read). The written-frame call passes it as `tables`.

**Parallel page edits.**
- `builder/addon-existing.mjs`: `routeOnExisting`'s page-step answer now carries the hand-over
  `{ from: "route", reason: "existing", page }`. The routing route echoes it for an edit with that
  reason (both answer shapes), and the request driver already forwards `handOver` to the edit body.
- `worker.js` (page step): `eExisting` (the hand-over's reason is `existing`; the add-on step's own
  `existing` hop gives the same) turns off the no-change retry. An unchanged page is answered
  `{ ok: true, satisfied: true, existing: true, cost: 0 }`, "The /x page already has what you asked
  for". Nothing is published and the edit costs nothing (as `page/no-change` already did).
- `builder/request.mjs`: **parts on one page are one edit** (`joinSamePage`, `settleJoined`). When a
  page-step run is filed, every other part already routed to the page step on that same page joins it,
  if it is ready, holds nothing back, puts nothing off, has no carved children, has no need either way,
  and has no remove, rename or tab. Its words go into what the job runs (taken out of `held` when the
  job already carried them). It is marked `joinedTo`, `blocked`, `why: "with:N"`, and it ends as that
  part ends (`outcome.with`). No cap: nothing is refused or limited; the same page is just not
  rewritten twice.

## 3. Tests and checks

- `test/frame-parallel.test.mjs`, 8 cases: FP1 tables and request; FP2 the table check; FP3 the live
  request (a kit import plus an unlisted table, retried with both reasons, then wired to
  `newsletter_signups`; a good first answer is one call); FP4 the Worker wiring; FP5 the `existing`
  hand-over and its echo; FP6 no retry and `satisfied` at no cost; FP7 two parts on `/lessons` are one
  job and `/cafe` still runs beside it; FP8 the rider ends with its job's part, with controls (held
  words, another layer).
- **Red**: on `origin/main` the file fails at import (`frameTables` and `joinSamePage` don't exist).
- **Sweep** (in a copy of the tree): 15 of 16 mutants killed. The survivor removes the loop's
  `status !== "ready"` skip, a redundancy: `clearToWrite` already holds a same-page part beside a
  running one. The comment-only control survived.
- **Full suite**: see §5.

## 4. Not done / limits

- A standalone (non-request) edit from the page does not forward the router's `handOver` on an edit,
  so the no-retry rule reaches request parts and the add-on step's `existing` hop only.
- Joining happens only between parts already routed when a run is filed (in the many-writes mode,
  parts route side by side, so they usually are). A part routed later to a page whose edit already ran
  is its own edit, as before.
- The whole-page rewrite stays the page step's way of changing a page. A small change still belongs
  to the cheaper steps (text, look) through the router.
- The container image rebuilds (builder modules changed). It is not predicted here.

## 5. Full suite

In this worktree (world-readable path): `12772 / 12767 / 2 / 3`, with 6 failing lines in total
(file-level and subtest). One is a real re-anchor: `addon-existing` "the router's answer is rewritten
to the page step" expected no hand-over, and it now expects the `existing` one (fixed; 14/14). The
others are this machine's: `no-generated-deps`' symlink case (the worktree's `node_modules` is a
symlink), and `parallel-coverage` PC 2, `site-add`, `canary-reopen-browser` and `media-verify`,
which fail under the full run's load and pass alone (5/5, 61/61, 2/2, 11/11).
