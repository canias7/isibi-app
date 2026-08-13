# Schema designer — does it produce a usable data model?

**16/20 samples clean.** 4 briefs × 5 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 11 pass, 3 fail, 1 n/a
- **validFamily** — 20 pass, 0 fail
- **tablesSurvive** — 19 pass, 1 fail
- **slotGuarded** — 5 pass, 0 fail
- **browsable** — 5 pass, 0 fail
- **capacityFn** — 4 pass, 1 fail

## What it cost

- output 1500 tok/sample · fresh in 4725 · cache read 361152 · write 19008
- 0.644 credits for the run

## Samples

- **menu 1** — clean
- **menu 2** — clean
- **menu 3** — clean
- **menu 4** — clean
- **menu 5** — seeded (unseeded: menu_items)
- **booking 1** — seeded (unseeded: services)
- **booking 2** — clean
- **booking 3** — seeded (unseeded: services)
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
- **capacity 4** — clean
- **capacity 5** — capacityFn (no functions declared at all); tablesSurvive (no tables)
  - why: `tables` came back as string, not a list [stop=tool_use, out=1680 tok]
