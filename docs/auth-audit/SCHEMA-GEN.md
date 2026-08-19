# Schema designer — does it produce a usable data model?

**18/20 samples clean.** 4 briefs × 5 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 13 pass, 0 fail, 2 n/a
- **validFamily** — 20 pass, 0 fail
- **tablesSurvive** — 18 pass, 2 fail
- **slotGuarded** — 5 pass, 0 fail
- **browsable** — 5 pass, 0 fail
- **capacityFn** — 3 pass, 2 fail

## What it cost

- output 1488 tok/sample · fresh in 4725 · cache read 410267 · write 21593
- 0.665 credits for the run

## Samples

- **menu 1** — clean
- **menu 2** — clean
- **menu 3** — clean
- **menu 4** — clean
- **menu 5** — clean
- **booking 1** — clean
- **booking 2** — clean
- **booking 3** — clean
- **booking 4** — clean
- **booking 5** — clean
- **marketplace 1** — clean
- **marketplace 2** — clean
- **marketplace 3** — clean
- **marketplace 4** — clean
- **marketplace 5** — clean
- **capacity 1** — clean
- **capacity 2** — capacityFn (no functions declared at all); tablesSurvive (no tables)
  - why: `tables` was a string that is NOT valid JSON — a stringified list would have been recovered [stop=tool_use, out=1886 tok]
- **capacity 3** — clean
- **capacity 4** — clean
- **capacity 5** — capacityFn (no functions declared at all); tablesSurvive (no tables)
  - why: `tables` was a string that is NOT valid JSON — a stringified list would have been recovered [stop=tool_use, out=1949 tok]
