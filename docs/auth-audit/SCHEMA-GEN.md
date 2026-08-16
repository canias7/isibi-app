# Schema designer — does it produce a usable data model?

**16/20 samples clean.** 4 briefs × 5 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 11 pass, 4 fail
- **validFamily** — 20 pass, 0 fail
- **tablesSurvive** — 20 pass, 0 fail
- **slotGuarded** — 5 pass, 0 fail
- **browsable** — 5 pass, 0 fail
- **capacityFn** — 5 pass, 0 fail

## What it cost

- output 1534 tok/sample · fresh in 4725 · cache read 369417 · write 19443
- 0.658 credits for the run

## Samples

- **menu 1** — seeded (unseeded: menu_items,opening_hours — no `seed` key at all)
- **menu 2** — clean
- **menu 3** — clean
- **menu 4** — clean
- **menu 5** — clean
- **booking 1** — seeded (unseeded: services — no `seed` key at all)
- **booking 2** — clean
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
- **capacity 4** — clean
- **capacity 5** — seeded (unseeded: classes — no `seed` key at all)
