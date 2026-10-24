# 2026-10-24 — a part waits on what it needs, not on how another part ended (branch `request-needs`)

Not merged, not deployed. Nothing spent, no model called, no live write.

## 1. The problem (two live runs, 2026-10-24)

- **Driftwood** (request 568e61a8…): part 1 (the home edits) had `needs: [0]`
  from `inferNeeds`, because "Book a lesson → new Lessons page" reads
  `new-page:/lessons`, which part 0 makes. Part 0 ended `partial` (caps dropped
  FAQ and Contact). `partial` was in `BAD`, so `broken(0)` held part 1
  `not-run` (`why: needs:0`) although `/lessons` had been created and the
  other home edits needed nothing.
- **Saltmarsh** (request 6598838c…): part 2 (Events) failed on a provider
  error; parts 3–6 had needs from the router's `dependsOn` ([0,2], [0,1,2,3]);
  the footer, spam protection and home edits did not use Events, and all
  became `not-run`. A carved child's failure also broke its parent
  (`broken()` walked children).

## 2. What changed

- **`builder/request-plan.mjs`**: `inferNeeds` records, per need, the concrete
  things the part reads that the other part creates (`part.needOn[m]`, e.g.
  `["page:/lessons"]`) — for a need it adds and also for one the router already
  said, when the router's `targets` show it. `needOn` / `neededFrom` helpers.
- **`builder/request.mjs`**:
  - every run job's answer records what the part really created
    (`p.created`: `page:/x` from `added`, `data:t` from `tables`), whatever the
    part ended as (`recordCreated`, right after `readRun`);
  - the gate asks `needMet(rec, p, m)` per need: done with its carved parts →
    yes; not yet ended (running, retrying a provider error, waiting on a
    question, recovering) → wait; ended `partial`/`failed` → a named need is
    met when each named thing is in what `m` and its carved parts created, an
    unnamed (router-only) need is met and the part's own step judges; ended
    `cancelled`/`expired`/`needs-rewrite`/`not-run`/`refused` → a named need is
    met only by what was created, an unnamed one is not met;
  - a held part records the things missing (`p.missing`), shown in the view;
  - `broken()` and `BAD` are gone: a carved child's failure no longer breaks
    its parent (the child's creations count as the parent's; a child still
    running is waited for).
- **`builder/site-reply.mjs`**: a part held on a named missing thing says
  *"Not started: “…”, because it uses the page “/lessons”, which “…” was to
  make, and it was not made."* An unnamed hold keeps the old sentence.
- **`builder/site-ask.mjs`**: `dependsOn`'s instruction now says a change
  needs another ONLY when it truly uses something the other creates (a link to
  the page it makes, a row in the table it makes); being in the same message,
  on the same page, later in the words, or touching the same part of the site
  is not needing. No keyword rules.

**Not done here (item 2's carving)**: a router-only dependent is not split by
the request layer; it is run whole and its own step judges (the edit and
add-on steps already refuse honestly what they cannot do).

## 3. Tests

- New `test/request-needs.test.mjs` (8 cases): the Driftwood replay through the
  real request flow (parent partial, `/lessons` created → the edit runs); the
  Saltmarsh replay (the addition fails → the part with an unnamed need runs,
  the part that links the page waits with `missing: ["page:/lessons"]` and the
  reply names the page, never "the rest of the site"); the gate with literals
  (named need met/missing for partial and failed; a stopped part still holds
  an unnamed need); a prerequisite running, retrying, waiting, recovering or
  uncertain is waited for; a carved child's failure does not break its parent;
  `inferNeeds` names the things; the reply and view; the router wording.
- Updated to the new rule: `request-plan` (2 cases), `request-flow` B2, H6b
  (now with named targets: still held, the new sentence), N3, M4, M6/starter
  (unnamed needs: the dependent now runs), `request-flow-page` PAGE 8 (named
  targets).
- **Red check against `origin/main` (692087cde)**: 7 of 8 new cases fail; the
  waiting case passes on both, as it should (main also waited).
- **Sweep**: 15 of 15 mutants killed (gate branches, `MADE_SOME`,
  `recordCreated`, children's creations, `ended`'s children, `missing`, the
  view, `inferNeeds`' two `needOn` calls, the reply sentence, the router
  wording); the comment-only control survived.
- Full unit suite: see §5.

## 4. Overlaps with the other helpers

- **`provider-retry`**: a part retrying a provider error is not terminal, so
  `needMet` answers `wait` — never broken. Whatever status that branch adds for
  "waiting on a retry", as long as it is not in `PART_TERMINAL`, dependents
  wait. If it ends such a part `failed` after its retries, an unnamed need then
  runs and a named one runs only if the thing was created.
- **`addon-uncapped`**: its fixes (the frame set-aside loss in `carveParts` /
  lost words; `heldFacts`) touch neighbouring code in `request.mjs` and
  `site-reply.mjs`; nothing here edits those lines. While this ran, that
  branch's uncommitted files appeared in this worktree (`builder/site-add.mjs`,
  `page-gen.mjs`, `page-bands.mjs`, `site-plan.mjs`, `design-graph.mjs`,
  `model-fanout.mjs`, `bfb.mjs`); they were left untouched and not committed.

## 5. Suite and image

- Full unit suite on `b2b53dcea` from a clean world-readable worktree
  (`node_modules` linked): `12487 / 12478 / 6 / 3`. One failure was this
  change's: `requirement-recovery` RC 7 pinned the old rule (a router-only need
  on a part that ended partial held the dependent); updated in the next commit
  (the "waits while recovering" half unchanged), and it passes. The other five
  are environment-only and pass alone or are the known ones: the
  no-generated-deps symlink case, the media browser mode, `canary-reopen`'s
  browser case, `purchase-recovery-card` RC 15 and `written-frame-edit`'s
  first-build case under load (the last two pass on their own).
- Image prediction, main `692087cde` → head: SiteBuildContainer
  `0bae00a7003bcc23` → `8213cd521ea8e999` (231 inputs; `request.mjs`,
  `request-plan.mjs`, `site-ask.mjs`, `site-reply.mjs` are inputs) — a
  rebuild; AppBuildContainer `65022ce71e3d7274` unchanged (9 inputs).
