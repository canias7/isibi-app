# 2026-10-22 — Audit finding 30 (A14-1): held draft changes told as saved, not live

**Finding** (`docs/audits/2026-10-17-builder-audit.md`, A14-1, high): under
DRAFT_FIRST, data, rules, add-row and pageless-addition answers carry
`draft: heldDraft(rev)` (`{published:false, held:true, revision, said}`) and no
`checks`. `builder/site-reply.mjs` never read `e.draft` / `a.draft`, so the
model reply's facts said the change was done, and a held rule added "It took
effect at once; nothing needed rebuilding." (both the rules branch and
`stepFacts`). `REPLY_SYSTEM` said every change was to "their live website".

**Re-verified on the current code** (HEAD `3fda8174d`) before fixing: the
lines were still there (`site-reply.mjs` rules notes at 848 and 1067; no read
of `draft` outside `recoveredFacts` and the build settlement). Real.

**Fix** (`builder/site-reply.mjs` only):
- `heldDraftOf(d)`: strict read (`published === false`, `held === true`,
  revision a positive safe integer), else null.
- `heldDraftFact`: on an `ok` edit or add-on answer with a held draft, one `k`
  fact: "Saved to the draft as revision N: the live site is unchanged until the
  owner presses Publish." Skipped when the answer's `checks.draft` already says
  so.
- Both "took effect at once" notes are said only when the answer is not held.
- `REPLY_SYSTEM`: "change their website (live, or saved to the draft when a
  fact says so)".

**Not in scope** (left for their own findings): A14-3 (page removal/move and
photo facts in the live tense beside the draft fact), A14-4 (Build "the rest of
the site is live"), A14-5/S5-1 (recovery saved as a draft told as published).

**Tests**: `test/reply-held-draft.test.mjs`, 7 cases with answers shaped as the
worker's routes give them (rules, data, a rules step beside a look, add-row,
pageless addition, malformed drafts, the system prompt). Red check against
HEAD's `site-reply.mjs`: 5 fail, 2 pass (the two controls). Green after.
Full suite: `11641 tests / 11632 pass / 6 fail / 3 skipped`. The failures are not this change: the media browser-mode case fails the same on HEAD (environment); site-render, wiring and request-flow-page passed when rerun alone (their failing locations were in another helper's worktree under `.claude/worktrees`).

Nothing paid, nothing deployed, not merged.
