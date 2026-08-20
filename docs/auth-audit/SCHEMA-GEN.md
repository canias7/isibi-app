# Schema designer — does it produce a usable data model?

**18/20 samples clean.** 4 briefs × 5 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 15 pass, 0 fail
- **validPlan** — 20 pass, 0 fail
- **tablesSurvive** — 20 pass, 0 fail
- **slotGuarded** — 5 pass, 0 fail
- **browsable** — 3 pass, 2 fail
- **capacityFn** — 5 pass, 0 fail

## What it cost

- output 1844 tok/sample · fresh in 4725 · cache read 377739 · write 19881
- 0.755 credits for the run

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
- **marketplace 1** — browsable (no table a signed-out visitor can read)
- **marketplace 2** — browsable (no table a signed-out visitor can read)
- **marketplace 3** — clean
- **marketplace 4** — clean
- **marketplace 5** — clean
- **capacity 1** — clean
- **capacity 2** — clean
- **capacity 3** — clean
- **capacity 4** — clean
- **capacity 5** — clean
