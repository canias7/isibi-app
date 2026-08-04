# Page generator — compile rate

**0/3 compiled** (0 first try, 0 with no lint problems).

One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## Distinct compile errors

- **11×** `error TS2322: Type 'X' is not assignable to type 'X'.`

## Samples

- **1. typecheck** — index.tsx, timetable.tsx, book.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(162,45): error TS2322: Type '{ title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/index.tsx(56,13): error TS2322: Type '{ className: string; title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/members.tsx(145,13): error TS2322: Type '{ title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/timetable.tsx(82,68): error TS2322: Type '{ className: string; title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
- **2. typecheck** — index.tsx, timetable.tsx, book.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(172,47): error TS2322: Type '{ title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/index.tsx(62,13): error TS2322: Type '{ className: string; title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/members.tsx(154,13): error TS2322: Type '{ title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/timetable.tsx(90,68): error TS2322: Type '{ className: string; title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
- **3. typecheck** — index.tsx, timetable.tsx, book.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(160,49): error TS2322: Type '{ title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/index.tsx(89,15): error TS2322: Type '{ className: string; title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`
  - `src/routes/members.tsx(156,13): error TS2322: Type '{ className: string; title: string; description: string; }' is not assignable to type 'IntrinsicAttributes & ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement>'.`