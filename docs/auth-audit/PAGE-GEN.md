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

- output 9,520 tok/sample · fresh in 4,059 · cache read 32,993 · write 16,497
- $0.2267 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **2×** `error TS2353: Object literal may only specify known properties, and 'X' does not exist in type 'X'.`
- **1×** `error TS2305: Module 'X' has no exported member 'X'.`
- **1×** `error TS2322: Type 'X' is not assignable to type 'X'.`

## Samples

- **booking 1. typecheck** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
  - `src/routes/account.tsx(31,10): error TS2305: Module '"@/components/ui/activity-feed"' has no exported member 'activityFeedPlaceholder'.`
  - `src/routes/work.tsx(39,35): error TS2353: Object literal may only specify known properties, and 'fallbackSeed' does not exist in type 'Shot'.`
  - `src/routes/work.tsx(40,35): error TS2353: Object literal may only specify known properties, and 'fallbackSeed' does not exist in type 'Shot'.`
- **menu 1. ok** — index.tsx
- **tool 1. typecheck** — index.tsx, records.tsx, record.tsx
  - `src/routes/record.tsx(115,13): error TS2322: Type '{ title: string; value: string; stage: string; }' is not assignable to type 'string | number | boolean | null | undefined'.`