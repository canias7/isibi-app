# Claude Code vs Coder: the full comparison

[`claude-code-vs-coder.xlsx`](claude-code-vs-coder.xlsx) puts every feature, setting and behaviour in Claude Code's docs (all 209 pages at code.claude.com/docs, read on 2026-11-20, and the changelog up to 2.1.330) next to what Coder has for it. It is in black and white, laid out like the owner's picture (2026-11-23).

**Tabs:**
- **Summary:** one line per section, with an icon, what the section covers, and how many rows are the same in Coder, different, missing from Coder, or only in Coder.
- **Everything:** all 15,866 rows. Columns: Section, Feature, Claude Code (what it does, docs page), Coder (what it does), Status, Note.
- **One tab per section** (68 sections), with the same columns.
- **Changelog:** every line of Claude Code's changelog, word for word (10,322 lines from 446 releases), each linked to its comparison row where there is one (7,443).

**How complete it is:**
- **Three passes:** helpers went through every page three times, each time listing every item on the page and adding what the sheet lacked.
  - The second pass found 19% missing.
  - The third pass found 11% missing.
- **Independent checks:** two separate checks then re-read samples of pages without looking at the makers' lists.
  - After the second pass: 95% of items found (2,672 of 2,823).
  - After the third pass: 98% (2,519 of 2,574, on 19 pages and page parts). The reference pages in that sample (hooks, errors, keyboard shortcuts) are at 99.6 to 100%.
  - What was still missing was small: the exact wording of the announcement-email templates, a version number, a reason sentence. Every gap a check found was added.
- **Wrong rows:** over the passes, 163 rows were corrected against the docs (10 of them on Coder's side), and 129 Coder entries were refreshed against Coder's current code.
- **Duplicates:** 57 rows that only repeated another row were removed.

Each Coder entry was checked in Coder's code (container/, src/, public/, README.md) on 2026-11-23. When Coder changes, the Coder column needs updating.
