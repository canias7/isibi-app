# Page generator — compile rate

**1/3 compiled**, 1 with no lint problems.

Three site shapes, each with its own schema, family and layout directive — a booking site, a
menu-only site with no form at all, and an internal tool where every page needs a signed-in member.

- booking (salon): 1/1 compiled, 1 clean
- menu (restaurant): 0/1 compiled
- tool (crm): 0/1 compiled

No database and no publish — this measures the GENERATOR, not the build path around it.
One call a sample, because a build makes one call: there is no repair pass, so this rate IS what the platform ships.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## What it cost

- output 8,982 tok/sample · fresh in 4,046 · cache read 32,200 · write 16,100
- $0.2169 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **9×** `error TS2322: Type 'X' is not assignable to type 'X'.`

## Samples

- **booking 1. ok** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
- **menu 1. no-pages** — (no files)
- **tool 1. typecheck** — index.tsx, records.tsx, record.tsx, playbook.tsx
  - `src/routes/record.tsx(117,40): error TS2322: Type '{ who: string; what: string; at: string | number | boolean; }[]' is not assignable to type 'Activity[]'.`
  - `src/routes/records.tsx(324,23): error TS2322: Type '(row: Deal) => React.JSX.Element' is not assignable to type '(row: Record<string, unknown>) => ReactNode'.`
  - `src/routes/records.tsx(333,53): error TS2322: Type '(row: Deal) => string' is not assignable to type '(row: Record<string, unknown>) => ReactNode'.`
  - `src/routes/records.tsx(334,54): error TS2322: Type '(row: Deal) => string' is not assignable to type '(row: Record<string, unknown>) => ReactNode'.`