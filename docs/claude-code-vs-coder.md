# Claude Code vs Coder: the full comparison

[`claude-code-vs-coder.xlsx`](claude-code-vs-coder.xlsx) puts every feature, setting and behaviour in Claude Code's docs (all 209 pages at code.claude.com/docs, read on 2026-11-20, and the changelog up to 2.1.330) next to what Coder has for it. It is in black and white, laid out like the owner's picture (2026-11-23).

**Tabs:**
- **Summary:** one line per section, with an icon, what the section covers, and how many rows are the same in Coder, different, missing from Coder, or only in Coder.
- **Everything:** all 17,931 rows. Columns: Section, Feature, Claude Code (what it does, docs page), Coder (what it does), Status, Note.
- **One tab per section** (68 sections), with the same columns.
- **Changelog:** every line of Claude Code's changelog, word for word (10,322 lines from 446 releases), each linked to its comparison row where there is one (7,442).

**How complete it is:**
- **Five passes:** helpers went through every page five times, each time listing every item on the page and adding what the sheet lacked.
  - The second pass found 19% missing.
  - The third found 11% missing.
  - The fourth, which also counted example values and sample code, found 7.7% missing.
  - The fifth found 6.3% missing.
- **Independent checks:** four separate checks then re-read fresh samples of pages without looking at the makers' lists.
  - After the second pass: 95% of items found (2,672 of 2,823).
  - After the third: 98% (2,519 of 2,574, on 19 pages and page parts).
  - After the fourth, with a stricter count that included every example value and line of sample code: 96.5% (2,490 of 2,581, on 11 fresh pages and page parts).
  - After the fifth, with the same strict count on 12 fresh pages: 98% (3,241 of 3,303), or 97% (1,854 of 1,910) without the environment-variables page, which that check counted sentence by sentence.
  - What the checks still found missing was mostly example details: an example value, a line of sample code, the full wording of a message. Every gap a check found was added.
- **Wrong rows:** over the passes, 199 rows were corrected against the docs (19 of them on Coder's side), and 129 Coder entries were refreshed against Coder's current code.
- **Duplicates:** 78 rows that only repeated another row were removed.

Each Coder entry was checked in Coder's code (container/, src/, public/, README.md) on 2026-11-23. When Coder changes, the Coder column needs updating.

**Update, 23 November 2026 (Coder's 28 new tools):** the rows about the Agent, workflow, scheduling, worktree, feedback, findings, artifact, connector-resource, plugin, skill and onboarding tools were checked against Coder's code and updated in every tab. In "Tools" 41 rows changed status and in "Tool parameters & limits" 88 did; about 280 more Coder entries that said Coder had no plugins, subagents, worktrees, scheduled tasks or artifacts were reworded. None of the new tools has been tried live on gofarther.dev yet, and each updated row says so in its Note.
