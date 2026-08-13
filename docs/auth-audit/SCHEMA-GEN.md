# Schema designer — does it produce a usable data model?

**3/4 samples clean.** 4 briefs × 1 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 2 pass, 0 fail, 1 n/a
- **validFamily** — 4 pass, 0 fail
- **tablesSurvive** — 3 pass, 1 fail
- **slotGuarded** — 1 pass, 0 fail
- **browsable** — 1 pass, 0 fail
- **capacityFn** — 0 pass, 1 fail

## What it cost

- output 1411 tok/sample · fresh in 945 · cache read 57024 · write 19008
- 0.176 credits for the run

## Samples

- **menu 1** — clean
- **booking 1** — clean
- **marketplace 1** — clean
- **capacity 1** — capacityFn (no functions declared at all); tablesSurvive (no tables)
