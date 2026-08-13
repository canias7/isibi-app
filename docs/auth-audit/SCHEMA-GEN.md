# Schema designer — does it produce a usable data model?

**15/20 samples clean.** 4 briefs × 5 samples, one call each.

No database, no publish, no account — this measures the DESIGNER, not the build path around it.
Each check is a property that is true or false, never a judgement about whether the schema is *good*.

## By check

- **seeded** — 10 pass, 5 fail
- **validFamily** — 20 pass, 0 fail
- **tablesSurvive** — 20 pass, 0 fail
- **slotGuarded** — 5 pass, 0 fail
- **browsable** — 5 pass, 0 fail
- **capacityFn** — 5 pass, 0 fail

## What it cost

- output 1543 tok/sample · fresh in 4725 · cache read 380160 · write 0
- 0.591 credits for the run

## Samples

- **menu 1** — clean
- **menu 2** — clean
- **menu 3** — seeded (unseeded: menu_items)
- **menu 4** — seeded (unseeded: menu_items,opening_hours)
- **menu 5** — seeded (unseeded: menu_items,opening_hours)
- **booking 1** — clean
- **booking 2** — clean
- **booking 3** — clean
- **booking 4** — seeded (unseeded: services)
- **booking 5** — clean
- **marketplace 1** — clean
- **marketplace 2** — clean
- **marketplace 3** — clean
- **marketplace 4** — clean
- **marketplace 5** — clean
- **capacity 1** — clean
- **capacity 2** — clean
- **capacity 3** — seeded (unseeded: booking_slots)
- **capacity 4** — clean
- **capacity 5** — clean
