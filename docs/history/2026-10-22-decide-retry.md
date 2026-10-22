# 2026-10-22 — A03-5 decided: a tweak that does not parse falls back to the rewrite

Branch `decide-retry` (from `origin/combine-groups` `36671236e`). Not merged,
not deployed, nothing spent, no model calls.

## The decision and what was built

The owner chose to check each tweak right away and, when it is broken, run
the full page rewrite for the same request automatically.

- **What really refuses a broken page** is the container's `vite build` in
  `recompileAndPublish`, run once after every step. A dry container compile
  per tweak would add a full build and Chromium render check to every tweak
  and is not separable from the spine without surgery (translation charges,
  render). The check used is the parser the tweak rung already holds
  (`tweakParser`, the template's TypeScript): its syntax diagnostics are what
  the bundler's transform refuses (an unclosed tag, a stray brace).
- `builder/site-tweak.mjs`: `tweakSyntax(text, parse)` (new, exported) and a
  `syntaxErrors` reader on the parser adapter; `readTweak` refuses a file that
  does not parse as `reason: "syntax"` (with `problems`), right after the
  truncation check.
- `worker.js`, page rung: a `syntax` refusal sets `twFallback`, marks the
  trace `tweak:fallback` (`reason`, `path`, problem count) and logs the first
  diagnostic; the existing fall-through then runs the rewrite once (no loop:
  the rewrite path has no route back to the tweak). The rewrite's reply carries
  `tweakFallback: "syntax"` (omitted otherwise). The stale A03-5 comment above
  `if (twPub.ok)` now points at the check.
- **Billing**: unchanged rules. The tweak's usage rides on the rewrite's bill
  (`twSpent`), as every refused tweak's does; a sound tweak never reaches the
  rewrite; a rewrite that also fails ends on today's failure path.
- **No parser (a Worker isolate)**: `tweakSyntax` answers `{checked: false}`
  (also for a parser that throws or lacks the reader), never "ok"; the tweak
  goes on exactly as before and the spine's compile stays the wall.

## Limits

- Syntax only. A bundling error (an import that does not resolve, a missing
  export, an undefined name) still fails once at the spine's compile with no
  rewrite, as before.
- The trace mark is not asserted by a route test (the reply field is).

## Tests

`test/tweak-fallback.test.mjs` (6 cases, real route, supplied answers,
stubbed compiler): fixtures discriminate; `readTweak` refuses `syntax`; no
parser is skipped; a broken tweak runs the rewrite once and ships its page
(one debit, tweak usage on it); a sound tweak never runs the rewrite (one
writer call, one debit); a rewrite that also fails matches today's control
(same status, error, debits, refunds; cost = what was taken). Note: a rewrite
that does not parse is already refused before compile by its own prose check
(`prose-preservation`, `unparsed`), so the failing rewrite case uses a page
that parses and the compiler refuses.

`test/parallel-prep-paths.test.mjs`: its `shownFile` stub echoed the
request context appended after the file, so its tweak answers did not parse;
corrected to cut at "THE WHOLE REQUEST THIS PART CAME FROM".

- **Red check** (old route, readTweak without the refusal): cases 2, 4, 6
  fail; controls 1, 3, 5 pass.
- **Sweep**: 6 of 6 killed (refusal dropped; errors ignored; adapter empty; no
  parser read as a pass; `checked` inverted; fallback not recorded); the
  comment-only control survived.
- **Affected files** (site-tweak, edit-page-*, edit-part-keep, wiring,
  edit-removal-door, parallel-prep-paths): 583 / 583 after the fixture fix.
- **Full suite** (root `node_modules` symlinked, removed before commit):
  `11968 / 11961 / 4 / 3`. Failures: `no-generated-deps` twice (the symlink
  itself), and one case each in `media-verify` and `purchase-recovery-card`
  that pass on rerun (timing; neither file touches the tweak).
