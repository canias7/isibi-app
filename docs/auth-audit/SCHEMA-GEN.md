# Schema designer — does it produce a usable data model?

**15/20 samples clean.** 4 briefs × 5 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 10 pass, 1 fail, 4 n/a
- **validFamily** — 20 pass, 0 fail
- **tablesSurvive** — 16 pass, 4 fail
- **slotGuarded** — 5 pass, 0 fail
- **browsable** — 5 pass, 0 fail
- **capacityFn** — 3 pass, 2 fail

## What it cost

- output 1608 tok/sample · fresh in 4725 · cache read 386156 · write 20324
- 0.689 credits for the run

## Samples

- **menu 1** — clean
- **menu 2** — tablesSurvive (no tables)
  - why: `tables` was a string that is NOT valid JSON — a stringified list would have been recovered [stop=tool_use, out=1013 tok]
- **menu 3** — tablesSurvive (no tables)
  - why: `tables` was a string that is NOT valid JSON — a stringified list would have been recovered [stop=tool_use, out=1568 tok]
- **menu 4** — clean
- **menu 5** — clean
- **booking 1** — clean
- **booking 2** — clean
- **booking 3** — clean
- **booking 4** — clean
- **booking 5** — seeded (unseeded: services — no `seed` key at all)
- **marketplace 1** — clean
- **marketplace 2** — clean
- **marketplace 3** — clean
- **marketplace 4** — clean
- **marketplace 5** — clean
- **capacity 1** — clean
- **capacity 2** — capacityFn (no functions declared at all); tablesSurvive (no tables)
  - why: `tables` was a string that is NOT valid JSON — a stringified list would have been recovered [stop=tool_use, out=1824 tok]
- **capacity 3** — clean
- **capacity 4** — clean
- **capacity 5** — capacityFn (no functions declared at all); tablesSurvive (no tables)
  - why: `tables` was a string that is NOT valid JSON — a stringified list would have been recovered [stop=tool_use, out=1746 tok]
