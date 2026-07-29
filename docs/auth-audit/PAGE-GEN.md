# Page generator — compile rate

**0/3 compiled** (0 first try, 0 with no lint problems).

One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## Distinct compile errors

- **7×** `error TS2345: Argument of type 'X' is not assignable to parameter of type 'X'.`
- **3×** `error TS18047: 'X' is possibly 'X'.`
- **1×** `error TS2339: Property 'X' does not exist on type 'X'.`

## Samples

- **1. typecheck** — index.tsx, timetable.tsx, manage.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(131,92): error TS18047: 's.ageSec' is possibly 'null'.`
  - `src/routes/account.tsx(338,24): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/members.tsx(160,47): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.`
- **2. typecheck** — index.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(88,22): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/account.tsx(311,27): error TS2339: Property 'role' does not exist on type 'Member'.`
  - `src/routes/account.tsx(458,72): error TS18047: 's.ageSec' is possibly 'null'.`
  - `src/routes/members.tsx(153,47): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.`
- **3. typecheck** — index.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(126,22): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/account.tsx(139,22): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/account.tsx(491,57): error TS18047: 's.ageSec' is possibly 'null'.`
  - `src/routes/members.tsx(155,47): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.`