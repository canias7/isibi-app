# Page generator — compile rate

**3/3 compiled**, 3 with no lint problems.

Three site shapes, each with its own schema, family and layout directive — a booking site, a
menu-only site with no form at all, and an internal tool where every page needs a signed-in member.

- booking (salon): 1/1 compiled, 1 clean
- menu (restaurant): 1/1 compiled, 1 clean
- tool (crm): 1/1 compiled, 1 clean

No database and no publish — this measures the GENERATOR, not the build path around it.
One call a sample, because a build makes one call: there is no repair pass, so this rate IS what the platform ships.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## What it cost

- output 10,490 tok/sample · fresh in 4,328 · cache read 33,819 · write 16,909
- $0.2439 a sample at list price · comments are 0.0% of the source written

## Samples

- **booking 1. ok** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
- **menu 1. ok** — index.tsx
- **tool 1. ok** — index.tsx, records.tsx, record.tsx, accounts.tsx, playbook.tsx