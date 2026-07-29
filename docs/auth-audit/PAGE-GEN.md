# Page generator — compile rate

**0/3 compiled** (0 first try, 0 with no lint problems).

One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## Distinct compile errors

- **4×** `error TS2322: Type 'X' is not assignable to type 'X'.`
- **4×** `error TS2345: Argument of type 'X' is not assignable to parameter of type 'X'.`
- **1×** `error TS2349: This expression is not callable.`
- **1×** `error TS2339: Property 'X' does not exist on type 'X'.`

## Samples

- **1. typecheck** — index.tsx, book.tsx, manage.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(105,29): error TS2322: Type '{}' is not assignable to type 'string'.`
  - `src/routes/account.tsx(449,26): error TS2349: This expression is not callable.`
  - `src/routes/book.tsx(52,24): error TS2322: Type 'number' is not assignable to type 'string'.`
  - `src/routes/members.tsx(110,75): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.`
- **2. typecheck** — index.tsx, booking.tsx, manage.tsx, members.tsx, announcements.tsx, account.tsx
  - `src/routes/account.tsx(125,27): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/announcements.tsx(55,51): error TS2339: Property 'role' does not exist on type 'Member'.`
  - `src/routes/booking.tsx(52,24): error TS2322: Type 'number' is not assignable to type 'string'.`
- **3. typecheck** — index.tsx, book.tsx, manage.tsx, members.tsx, announcements.tsx, account.tsx
  - `src/routes/account.tsx(107,27): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/book.tsx(53,26): error TS2322: Type 'number' is not assignable to type 'string'.`
  - `src/routes/members.tsx(155,43): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.`