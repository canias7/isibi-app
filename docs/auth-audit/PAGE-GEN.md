# Page generator — compile rate

**0/3 compiled** (0 first try, 0 with no lint problems).

One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.
A single failure is variance; a column of the same error is a mismatch worth fixing.

## Distinct compile errors

- **6×** `error TS2345: Argument of type 'X' is not assignable to parameter of type 'X'.`
- **5×** `error TS2339: Property 'X' does not exist on type 'X'.`
- **3×** `error TS2322: Type 'X' is not assignable to type 'X'.`
- **3×** `error TS7006: Parameter 'X' implicitly has an 'X' type.`
- **1×** `error TS2741: Property 'X' is missing in type 'X' but required in type 'X'.`

## Samples

- **1. typecheck** — index.tsx, manage.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(110,29): error TS2322: Type '{}' is not assignable to type 'string'.`
  - `src/routes/account.tsx(451,27): error TS2339: Property 'map' does not exist on type 'NoInfer<{ sessions: SiteSession[]; }>'.`
  - `src/routes/account.tsx(451,32): error TS7006: Parameter 's' implicitly has an 'any' type.`
  - `src/routes/index.tsx(94,10): error TS2741: Property 'search' is missing in type '{ children: string; to: "/manage"; className: string; }' but required in type 'MakeRequiredSearchParams<RouterCore<Route<Register, any, "/", "/", string, "__root__", undefined, {}, { queryClient: QueryClient; }, AnyContext, AnyContext, ... 6 more ..., undefined>, "never", false, RouterHistory, Record<...>>, string, "/manage">'.`
- **2. typecheck** — index.tsx, booking.tsx, manage.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(119,25): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/account.tsx(445,27): error TS2339: Property 'map' does not exist on type 'NoInfer<{ sessions: SiteSession[]; }>'.`
  - `src/routes/account.tsx(445,32): error TS7006: Parameter 's' implicitly has an 'any' type.`
  - `src/routes/booking.tsx(59,7): error TS2322: Type '(data: { row: BookingRow; claim?: string; }) => void' is not assignable to type '(data: { row: Row; claim?: string | undefined; }, variables: Partial<Row>, onMutateResult: unknown, context: MutationFunctionContext) => void'.`
- **3. typecheck** — index.tsx, members.tsx, account.tsx
  - `src/routes/account.tsx(97,27): error TS2345: Argument of type '{}' is not assignable to parameter of type 'SetStateAction<string | null>'.`
  - `src/routes/account.tsx(417,27): error TS2339: Property 'length' does not exist on type 'NoInfer<{ sessions: SiteSession[]; }>'.`
  - `src/routes/account.tsx(421,27): error TS2339: Property 'map' does not exist on type 'NoInfer<{ sessions: SiteSession[]; }>'.`
  - `src/routes/account.tsx(421,32): error TS7006: Parameter 's' implicitly has an 'any' type.`