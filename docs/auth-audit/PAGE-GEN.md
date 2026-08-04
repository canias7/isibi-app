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

- output 10,901 tok/sample · fresh in 4,046 · cache read 18,477 · write 9,239
- $0.2158 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **8×** `error TS7006: Parameter 'X' implicitly has an 'X' type.`
- **7×** `error TS2322: Type 'X' is not assignable to type 'X'.`
- **6×** `error TS2353: Object literal may only specify known properties, and 'X' does not exist in type 'X'.`
- **3×** `error TS2367: This comparison appears to be unintentional because the types 'X' and 'X' have no overlap.`
- **1×** `error TS2305: Module 'X' has no exported member 'X'.`

## Distinct lint problems

- **1×** More than 6 pages were written; only the first 6 were kept.

## Samples

- **booking 1. typecheck** — index.tsx, book.tsx, manage.tsx, work.tsx, notes.tsx, announcements.tsx
  - `src/routes/announcements.tsx(44,21): error TS2322: Type '"/account"' is not assignable to type '"/" | "/announcements" | "/book" | "/manage" | "/notes" | "/work" | "." | ".."'.`
  - `src/routes/notes.tsx(68,21): error TS2322: Type '"/account"' is not assignable to type '"/" | "/announcements" | "/book" | "/manage" | "/notes" | "/work" | "." | ".."'.`
  - lint: More than 6 pages were written; only the first 6 were kept.
- **menu 1. ok** — index.tsx
- **tool 1. typecheck** — index.tsx, records.tsx, record.tsx
  - `src/routes/record.tsx(134,40): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.`
  - `src/routes/record.tsx(180,9): error TS2322: Type '{ title: string; subtitle: string; badge: Element; }' is not assignable to type 'IntrinsicAttributes & { title: string; subtitle?: string | undefined; status?: ReactNode; actions?: ReactNode; className?: string | undefined; }'.`
  - `src/routes/record.tsx(254,19): error TS2353: Object literal may only specify known properties, and 'id' does not exist in type 'Activity'.`
  - `src/routes/record.tsx(255,19): error TS2353: Object literal may only specify known properties, and 'id' does not exist in type 'Activity'.`