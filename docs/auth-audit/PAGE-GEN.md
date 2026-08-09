# Page generator — compile rate

**2/3 compiled**, 2 with no lint problems.

Three site shapes, each with its own schema, family and layout directive — a booking site, a
menu-only site with no form at all, and an internal tool where every page needs a signed-in member.

- booking (salon): 0/1 compiled
- menu (restaurant): 1/1 compiled, 1 clean
- tool (crm): 1/1 compiled, 1 clean

No database and no publish — this measures the GENERATOR, not the build path around it.
One call a sample, because a build makes one call: there is no repair pass, so this rate IS what the platform ships.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## What it cost

- output 9,488 tok/sample · fresh in 4,070 · cache read 33,721 · write 16,861
- $0.2279 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **1×** `error TS2322: Type 'X' is not assignable to type 'X'.`

## Samples

- **booking 1. typecheck** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
  - `src/routes/index.tsx(107,13): error TS2322: Type '({ name: string; description: string; price: number; meta: string; } | undefined)[]' is not assignable to type 'PriceRow[]'.`
- **menu 1. ok** — index.tsx
- **tool 1. ok** — index.tsx, records.tsx, record.tsx