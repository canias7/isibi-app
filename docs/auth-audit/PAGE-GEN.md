# Page generator — compile rate

**2/3 compiled**, 2 with no lint problems.

Three site shapes, each with its own schema, family and layout directive — a booking site, a
menu-only site with no form at all, and an internal tool where every page needs a signed-in member.

- booking (salon): 1/1 compiled, 1 clean
- menu (restaurant): 1/1 compiled, 1 clean
- tool (crm): 0/1 compiled

No database and no publish — this measures the GENERATOR, not the build path around it.
One call a sample, because a build makes one call: there is no repair pass, so this rate IS what the platform ships.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## What it cost

- output 10,539 tok/sample · fresh in 4,025 · cache read 18,428 · write 9,214
- $0.2102 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **5×** `error TS2353: Object literal may only specify known properties, and 'X' does not exist in type 'X'.`
- **3×** `error TS2322: Type 'X' is not assignable to type 'X'.`
- **2×** `error TS2367: This comparison appears to be unintentional because the types 'X' and 'X' have no overlap.`
- **2×** `error TS2345: Argument of type 'X' is not assignable to parameter of type 'X'.`
- **1×** `error TS7006: Parameter 'X' implicitly has an 'X' type.`

## Samples

- **booking 1. ok** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
- **menu 1. ok** — index.tsx
- **tool 1. typecheck** — index.tsx, records.tsx, record.tsx
  - `src/routes/record.tsx(111,40): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.`
  - `src/routes/record.tsx(173,9): error TS2322: Type '{ className: string; title: string; subtitle: string; badge: Element; actions: Element | undefined; }' is not assignable to type 'IntrinsicAttributes & { title: string; subtitle?: string | undefined; status?: ReactNode; actions?: ReactNode; className?: string | undefined; }'.`
  - `src/routes/record.tsx(266,15): error TS2353: Object literal may only specify known properties, and 'title' does not exist in type 'Activity'.`
  - `src/routes/record.tsx(267,15): error TS2353: Object literal may only specify known properties, and 'title' does not exist in type 'Activity'.`