# Page generator — compile rate

**2/3 compiled** (2 first try, 2 with no lint problems).

One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## Distinct compile errors

- **3×** `error TS2307: Cannot find module 'X' or its corresponding type declarations.`
- **1×** `error TS2554: Expected 1-2 arguments, but got 0.`

## Distinct lint problems

- **1×** More than 6 pages were written; only the first 6 were kept.

## Samples

- **1. typecheck** — index.tsx, booking.tsx, manage.tsx, members.tsx, announcements.tsx, account.tsx
  - `src/routes/account.tsx(17,26): error TS2307: Cannot find module '@/components/sign-in-prompt' or its corresponding type declarations.`
  - `src/routes/account.tsx(83,24): error TS2554: Expected 1-2 arguments, but got 0.`
  - `src/routes/announcements.tsx(5,26): error TS2307: Cannot find module '@/components/sign-in-prompt' or its corresponding type declarations.`
  - `src/routes/members.tsx(20,26): error TS2307: Cannot find module '@/components/sign-in-prompt' or its corresponding type declarations.`
  - lint: More than 6 pages were written; only the first 6 were kept.
- **2. ok** — index.tsx, manage.tsx, members.tsx, announcements.tsx, account.tsx
- **3. ok** — index.tsx, manage.tsx, members.tsx, announcements.tsx, account.tsx