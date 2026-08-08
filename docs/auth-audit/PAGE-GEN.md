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

- output 9,880 tok/sample · fresh in 4,059 · cache read 32,977 · write 16,489
- $0.2321 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **12×** `error TS2353: Object literal may only specify known properties, and 'X' does not exist in type 'X'.`
- **3×** `error TS2322: Type 'X' is not assignable to type 'X'.`

## Samples

- **booking 1. typecheck** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
  - `src/routes/index.tsx(136,37): error TS2353: Object literal may only specify known properties, and 'fallbackSeed' does not exist in type 'Shot'.`
  - `src/routes/index.tsx(137,37): error TS2353: Object literal may only specify known properties, and 'fallbackSeed' does not exist in type 'Shot'.`
  - `src/routes/index.tsx(138,37): error TS2353: Object literal may only specify known properties, and 'fallbackSeed' does not exist in type 'Shot'.`
  - `src/routes/work.tsx(34,35): error TS2353: Object literal may only specify known properties, and 'fallbackSeed' does not exist in type 'Shot'.`
- **menu 1. ok** — index.tsx
- **tool 1. typecheck** — index.tsx, records.tsx, record.tsx
  - `src/routes/record.tsx(99,22): error TS2322: Type '{ stage: string; }' is not assignable to type 'string | number | boolean | null | undefined'.`
  - `src/routes/record.tsx(116,22): error TS2322: Type '{ value: string; }' is not assignable to type 'string | number | boolean | null | undefined'.`
  - `src/routes/records.tsx(135,15): error TS2322: Type '{ stage: string; }' is not assignable to type 'string | number | boolean | null | undefined'.`