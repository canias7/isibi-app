# Page generator — compile rate

**1/3 compiled**, 1 with no lint problems.

Three site shapes, each with its own schema, family and layout directive — a booking site, a
menu-only site with no form at all, and an internal tool where every page needs a signed-in member.

- booking (salon): 0/1 compiled
- menu (restaurant): 1/1 compiled, 1 clean
- tool (crm): 0/1 compiled

No database and no publish — this measures the GENERATOR, not the build path around it.
One call a sample, because a build makes one call: there is no repair pass, so this rate IS what the platform ships.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## What it cost

- output 9,608 tok/sample · fresh in 4,046 · cache read 31,279 · write 15,640
- $0.2243 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **4×** `error TS2353: Object literal may only specify known properties, and 'X' does not exist in type 'X'.`
- **4×** `error TS7006: Parameter 'X' implicitly has an 'X' type.`
- **3×** `error TS2322: Type 'X' is not assignable to type 'X'.`
- **1×** `error TS2367: This comparison appears to be unintentional because the types 'X' and 'X' have no overlap.`

## Samples

- **booking 1. typecheck** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
  - `src/routes/account.tsx(200,15): error TS2322: Type '{ who: string; what: string; at: unknown; }[]' is not assignable to type 'Activity[]'.`
- **menu 1. ok** — index.tsx
- **tool 1. typecheck** — index.tsx, records.tsx, record.tsx
  - `src/routes/record.tsx(91,40): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string | undefined' have no overlap.`
  - `src/routes/records.tsx(139,37): error TS2353: Object literal may only specify known properties, and 'render' does not exist in type 'Column<Deal>'.`
  - `src/routes/records.tsx(139,46): error TS7006: Parameter 'd' implicitly has an 'any' type.`
  - `src/routes/records.tsx(140,38): error TS2353: Object literal may only specify known properties, and 'render' does not exist in type 'Column<Deal>'.`