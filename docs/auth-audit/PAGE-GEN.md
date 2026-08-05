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

- output 10,611 tok/sample · fresh in 4,046 · cache read 32,298 · write 16,149
- $0.2416 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **1×** `error TS2305: Module 'X' has no exported member 'X'.`

## Samples

- **booking 1. typecheck** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
  - `src/routes/account.tsx(31,10): error TS2305: Module '"@/lib/rows"' has no exported member 'activityFeedFallback'.`
- **menu 1. ok** — index.tsx
- **tool 1. ok** — index.tsx, records.tsx, record.tsx, accounts.tsx, playbook.tsx