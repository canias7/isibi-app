# Page generator — compile rate

**1/3 compiled**, 1 with no lint problems.

One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.
One call a sample, because a build makes one call: there is no repair pass, so this rate IS what the platform ships.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## What it cost

- output 11,827 tok/sample · fresh in 780 · cache read 18,113 · write 9,057
- $0.2191 a sample at list price · comments are 0.0% of the source written

## Distinct compile errors

- **1×** `error TS2345: Argument of type 'X' is not assignable to parameter of type 'X'.`
- **1×** `error TS2322: Type 'X' is not assignable to type 'X'.`

## Samples

- **1. ok** — index.tsx, timetable.tsx, book.tsx, members.tsx, account.tsx
- **2. typecheck** — index.tsx, timetable.tsx, book.tsx, notes.tsx, account.tsx
  - `src/routes/notes.tsx(178,45): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.`
- **3. typecheck** — index.tsx, timetable.tsx, book.tsx, members.tsx, account.tsx
  - `src/routes/index.tsx(55,11): error TS2322: Type '{ title: string; time: string; description: string; }[]' is not assignable to type '{ id: string | number; at: string | number | Date; title: string; meta?: ReactNode; }[]'.`