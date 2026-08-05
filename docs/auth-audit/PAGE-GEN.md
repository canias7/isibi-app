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

- output 10,080 tok/sample · fresh in 4,046 · cache read 29,017 · write 14,509
- $0.2264 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **5×** `error TS2322: Type 'X' is not assignable to type 'X'.`
- **1×** `error TS2367: This comparison appears to be unintentional because the types 'X' and 'X' have no overlap.`
- **1×** `error TS2353: Object literal may only specify known properties, and 'X' does not exist in type 'X'.`
- **1×** `error TS7006: Parameter 'X' implicitly has an 'X' type.`
- **1×** `error TS2345: Argument of type 'X' is not assignable to parameter of type 'X'.`

## Samples

- **booking 1. ok** — index.tsx, book.tsx, manage.tsx, work.tsx, account.tsx
- **menu 1. ok** — index.tsx
- **tool 1. typecheck** — index.tsx, records.tsx, record.tsx
  - `src/routes/record.tsx(66,40): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string | undefined' have no overlap.`
  - `src/routes/record.tsx(271,40): error TS2322: Type '{ id: string; title: string; at: unknown; }[]' is not assignable to type 'Activity[]'.`
  - `src/routes/records.tsx(384,19): error TS2353: Object literal may only specify known properties, and 'onClick' does not exist in type '{ label: string; onSelect: () => void; destructive?: boolean | undefined; }'.`
  - `src/routes/records.tsx(410,26): error TS7006: Parameter 'd' implicitly has an 'any' type.`