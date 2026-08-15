# Schema designer — does it produce a usable data model?

**15/20 samples clean.** 4 briefs × 5 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 10 pass, 4 fail, 1 n/a
- **validFamily** — 20 pass, 0 fail
- **tablesSurvive** — 19 pass, 1 fail
- **slotGuarded** — 5 pass, 0 fail
- **browsable** — 5 pass, 0 fail
- **capacityFn** — 4 pass, 1 fail

## What it cost

- output 1489 tok/sample · fresh in 4725 · cache read 361152 · write 19008
- 0.641 credits for the run

## Samples

- **menu 1** — clean
- **menu 2** — seeded (unseeded: menu_items — no `seed` key at all)
- **menu 3** — seeded (unseeded: menu_items,opening_hours — no `seed` key at all)
- **menu 4** — clean
- **menu 5** — clean
- **booking 1** — clean
- **booking 2** — seeded (unseeded: services — no `seed` key at all)
- **booking 3** — seeded (unseeded: services — no `seed` key at all)
- **booking 4** — clean
- **booking 5** — clean
- **marketplace 1** — clean
- **marketplace 2** — clean
- **marketplace 3** — clean
- **marketplace 4** — clean
- **marketplace 5** — clean
- **capacity 1** — clean
- **capacity 2** — clean
- **capacity 3** — clean
- **capacity 4** — capacityFn (no functions declared at all); tablesSurvive (no tables)
  - why: `tables` was a string that is NOT valid JSON — a stringified list would have been recovered [stop=tool_use, out=1891 tok]
- **capacity 5** — clean
