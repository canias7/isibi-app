# Claude Code vs Coder: the full comparison

[`claude-code-vs-coder.xlsx`](claude-code-vs-coder.xlsx) puts every feature, setting and behaviour in Claude Code's docs (all 209 pages at code.claude.com/docs, read on 2026-11-20, and the changelog up to 2.1.330) next to what Coder has for it. It is in black and white, laid out like the owner's picture (2026-11-23).

**Tabs:**
- **Summary:** one line per section, with an icon, what the section covers, and how many rows are the same in Coder, different, missing from Coder, or only in Coder.
- **Everything:** all 17,023 rows. Columns: Section, Feature, Claude Code (what it does, docs page), Coder (what it does), Status, Note.
- **One tab per section** (68 sections), with the same columns.
- **Changelog:** every line of Claude Code's changelog, word for word (10,322 lines from 446 releases), each linked to its comparison row where there is one (7,442).

**How complete it is:**
- **Four passes:** helpers went through every page four times, each time listing every item on the page and adding what the sheet lacked.
  - The second pass found 19% missing.
  - The third pass found 11% missing.
  - The fourth pass, which also counted example values and sample code, found 7.7% missing.
- **Independent checks:** three separate checks then re-read fresh samples of pages without looking at the makers' lists.
  - After the second pass: 95% of items found (2,672 of 2,823).
  - After the third pass: 98% (2,519 of 2,574, on 19 pages and page parts).
  - After the fourth pass, on 11 fresh pages and page parts: 96.5% (2,490 of 2,581). This check was stricter and counted every example value and every line of sample code as an item. What it still found missing was mostly such example details: an import path, a sample file's contents, an example reply. Every gap a check found was added.
- **Wrong rows:** over the passes, 184 rows were corrected against the docs (16 of them on Coder's side), and 129 Coder entries were refreshed against Coder's current code.
- **Duplicates:** 72 rows that only repeated another row were removed.

Each Coder entry was checked in Coder's code (container/, src/, public/, README.md) on 2026-11-23. When Coder changes, the Coder column needs updating.
