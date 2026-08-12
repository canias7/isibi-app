// Data access for a generated site.
//
// The generator should never write fetch code — it calls these hooks and names
// a table. Everything else (where the site lives, how rows are shaped, how the
// cache is invalidated after a write) is handled here once.
//
// Reads and writes go to the site's own Neon Data API through /api/db/<slug>/data/,
// and the site's RLS policies decide every access question — a `display` table is
// readable by anyone, a `collect` table is write-only, and `user`/`feed`/`admin`
// tables answer according to the member session sent with the request.
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

// VALUES ARE SCALARS, for exactly the reason written out under `PublicRow`
// below — and this type kept `unknown` while its sibling was fixed.
//
// `useRows<Row>("posts")` then gives every field the type `unknown`, so
// `<li>{row.title}</li>` is `TS2322: unknown is not assignable to ReactNode`,
// and handing `row.created_at` to anything expecting `string | number | Date` is
// the same error one layer along. Measured live 2026-08-04: the generator got
// the field NAMES exactly right — `{who, what, at}` against
// `Activity = {who, what, at, avatar?}`, which is the named-type fix working —
// and still failed, on `at: unknown` alone. One error, and it was the only thing
// between the booking sample and a pass.
//
// The columns a site declares are text / integer / real / boolean, so this is
// what actually comes back. A `json` column arrives as an object and is the one
// inexact case; rendering one in JSX is wrong whatever its type says, so typing
// for it would buy nothing and cost every ordinary page a compile error.
// `created_at` IS NAMED, and not for tidiness. It is the one column a page reads
// that the model's own `type Deal = Row & { title: string }` cannot narrow — a
// declared column gets a type in that intersection, a platform-managed one is
// left on the index signature. So `at: deal.created_at` is
// `string | number | boolean | null` against `string | number | Date`. Measured
// live 2026-08-05: TS2322, page refused, whole CRM sample a placeholder.
//
// Non-optional because `site-schema.mjs` adds it to EVERY table unconditionally
// — not behind the `timestamps` flag, which is `updated_at`. A test asserts that
// stays true, because `string` here is a claim about that file.
//
// WHY THIS IS A LITERAL INDEX SIGNATURE AND NOT `Record<…> & {…}`. Naming
// `created_at` fixed one half and the model went straight to the other:
// `at: deal.updated_at ?? deal.created_at ?? new Date().toISOString()` is
// `string | number | boolean` against `string | number | Date`, because
// `updated_at` is still on the index signature and `??` only strips the `null`.
// The date prop has now failed in two consecutive evals wearing two different
// types, which is a column and not variance.
//
// `updated_at` cannot be typed inside an INTERSECTION: a property type there is
// intersected with the index signature's, so `updated_at?: string` collapses to
// plain `string` and claims a column exists on every table when it only exists
// behind `timestamps`. Written as one literal with `undefined` in the index
// signature, the optional marker means what it says — `string | undefined`, which
// the model's own `??` chain resolves — and the wider signature is TRUE of any
// column nobody declared.
export type Row = {
  [column: string]: string | number | boolean | null | undefined;
  id: number;
  created_at: string;
  /** Only on a table that declared `timestamps`, which is why it is optional. */
  updated_at?: string;
};

/**
 * A row id being passed IN.
 *
 * Deliberately not `number`, even though a row genuinely comes back with a
 * numeric `id`. Every id a page has to hand arrives from the URL — a route
 * param or a search param — and the router hands those over as STRINGS. Typing
 * the argument as `number` meant no page that edits, deletes or manages a row
 * could compile without a `Number()` the generator had no reason to write, so
 * `tsc` refused the page and the whole site published as the placeholder.
 * Measured live 2026-07-29, three separate errors in one build.
 *
 * Nothing does arithmetic on an id; it goes straight into a URL. So: `number`
 * coming out, `string | number` going in.
 */
export type RowId = string | number;

/**
 * A row from a table's public projection, which has NO `id`.
 *
 * Not a cosmetic distinction. The schema engine refuses `id` and `owner_id` in a
 * `publicView` — publishing a sequential id from an owner-scoped table tells a
 * stranger how many bookings exist and lets them be counted — and the API
 * selects only the columns the projection declares. So these rows really do
 * arrive without one.
 *
 * `usePublicRows` was typed `<T extends Row>`, which demanded the very field the
 * projection can never contain: an honest type was a compile error, and the only
 * type that compiled was a lie that left `row.id` undefined at runtime — which
 * is a React `key` of `undefined` on every row. There was no correct way to call
 * it. Use a published column as the key, or the index.
 */
export type PublicRow = Record<string, string | number | boolean | null>;

// WHY THE VALUES ARE SCALARS AND NOT `unknown`.
//
// It was `Record<string, unknown>`, and that made the obvious call a compile
// error: `usePublicRows("bookings")` with no type argument gives every field the
// type `unknown`, and `<li>{row.appointment_time}</li>` is then
// `TS2322: Type 'unknown' is not assignable to type 'ReactNode'`. Measured live
// 2026-08-04 at `book.tsx(148,78)` — the site published as the placeholder.
//
// It only became reachable when the view was finally created: before that
// nothing could call this hook successfully at all, so the type never got
// exercised. Same class as `RowId`, the `Row` constraint and the optional
// `claim` — the client API not being the shape a reasonable caller assumes.
//
// A projection publishes DECLARED COLUMNS, and those are text / integer / real /
// boolean, so this is what actually comes back. The one inexact case is a `json`
// column, whose value arrives as an object — and rendering one in JSX is wrong
// whatever its type says, so typing for it would buy nothing and cost every
// ordinary page a compile error.

/** Query parameters a list read accepts. Anything else is ignored by the API. */
export type RowQuery = {
  limit?: number;
  offset?: number;
  /** Column to sort by. Falls back to id if the table did not declare it. */
  order?: string;
  dir?: "asc" | "desc";
  /** Full-text search — only does anything if the table declared `fts`. */
  q?: string;
  /** Any declared column, as an equality filter. */
  [column: string]: string | number | undefined;
};

/**
 * A published site is served from /s/<slug>/, so it can read its own slug off
 * the path rather than having the generator bake it in. Falls back to a build
 * -time value for local dev, where the site is served from /.
 */
export function siteSlug(): string {
  // NO BROWSER AT BUILD TIME. Each route is rendered to HTML once by
  // `entry-server.tsx`, in Node, where `window` does not exist — and this
  // function runs inside `useRows`, so it is on the path of every real page.
  //
  // The failure it caused is the reason for the guard rather than a try/catch
  // somewhere upstream: React catches a throw during a server render, silently
  // switches that subtree to client rendering, and hands back 5.6 KB of markup
  // containing no words at all. No exception reaches the caller. Every page
  // "prerendered" successfully and every snapshot was empty — measured on the
  // first run, and invisible to anything checking that a string came back.
  //
  // "" is correct here, not a guess: nothing fetches during a prerender (no
  // query is ever awaited), so the slug is only ever used to build a URL that
  // is not called. In a browser this line cannot be reached.
  if (typeof window === "undefined") return "";
  const fromPath = window.location.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]*)/i);
  if (fromPath) return fromPath[1].toLowerCase();
  // ON A CUSTOM DOMAIN THERE IS NO SUCH PATH. The site is served at `/` on the
  // owner's own hostname, the match above fails, and without this line every
  // read and every form would address whatever the build-time default happens
  // to be — a DIFFERENT site's API, silently, on the domain the owner actually
  // gives to customers.
  //
  // Written into the head at publish time by `injectMeta`, which is the one
  // place that rewrites the built document. Read here rather than baked into
  // the bundle so it is right whichever hostname served the page.
  const tag = document.querySelector('meta[name="site-slug"]')?.getAttribute("content");
  if (tag && /^[a-z0-9][a-z0-9-]*$/i.test(tag)) return tag.toLowerCase();
  return (import.meta as { env?: Record<string, string> }).env?.VITE_SITE_SLUG ?? "preview";
}

// ── Talking to the database ─────────────────────────────────────────────────
//
// Rows come from the site's own Neon Data API, which is PostgREST — so a filter is
// `?col=eq.value`, a sort is `?order=col.desc`, and an insert answers 201 with an
// empty body unless it asks otherwise — which `useCreateRow` deliberately does
// not, because asking needs SELECT and a `collect` table has none. The platform's
// own row routes were deleted 2026-07-30;
// these paths forward to Neon and nothing more, and the site's RLS policies decide
// every access question.
//
// The generator never writes any of this. It calls a hook and names a table.

const base = (table: string) => `/api/db/${siteSlug()}/data/${table}`;

/**
 * The spam-challenge field, attached to a submission when there is one.
 *
 * THE GENERATOR NEVER WRITES THIS AND NEVER SEES IT. A page renders
 * `<SpamGuard />` inside its form and calls `useCreateRow` exactly as it always
 * has; the token is picked up here. Written the other way round — as an
 * argument the page has to pass — every form the model has already produced
 * would submit without one and be refused the day an owner switched protection
 * on.
 *
 * The field name is Turnstile's own. The Worker STRIPS it before the row
 * reaches Postgres, because it is not a column any site declared.
 */
const CHALLENGE_FIELD = "cf-turnstile-response";
type TurnstileApi = {
  getResponse: (id?: string) => string | undefined;
  reset: (id?: string) => void;
  execute: (id?: string) => void;
};
const turnstileApi = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

function challenged(values: Record<string, unknown>): Record<string, unknown> {
  // Absent on every site with no protection configured, which is why this can
  // sit on the write path of every form without changing any of them.
  let token: string | undefined;
  // `getResponse` throws when no widget has been rendered — which is the
  // ordinary case on a page that has the script but no guard.
  try { token = turnstileApi()?.getResponse(); } catch { token = undefined; }
  return token ? { ...values, [CHALLENGE_FIELD]: token } : values;
}

/**
 * Spend the token and start earning the next one.
 *
 * A TOKEN IS SINGLE-USE, so without this the SECOND submission from one visitor
 * is refused with `timeout-or-duplicate` — somebody booking two haircuts, or
 * anybody whose first attempt failed validation and who fixes it and tries
 * again. That second case is the common one and it looks exactly like the site
 * being broken.
 *
 * Run whether the write succeeded or not: the token is spent at Cloudflare
 * before Postgres ever sees the row, so a refused insert has consumed it just
 * the same.
 */
function resetChallenge(): void {
  const t = turnstileApi();
  if (!t) return;
  try { t.reset(); t.execute(); } catch { /* no widget rendered */ }
}

/** PostgREST's equality filter, and the query shape a list read accepts. */
function pgQuery(params?: RowQuery, opts?: { noDefaultOrder?: boolean }): string {
  const sp = new URLSearchParams();
  sp.set("select", "*");
  if (!params) return "?" + sp.toString();
  const { limit, offset, order, dir, q, ...filters } = params;
  if (limit !== undefined) sp.set("limit", String(limit));
  if (offset !== undefined) sp.set("offset", String(offset));
  // Newest first by default: these are usually submissions or posts, and the
  // useful one is the latest.
  //
  // `noDefaultOrder` is for a public projection, which HAS NO `id` — the schema
  // engine refuses id and owner_id in one. Defaulting to `id.desc` there asks
  // Postgres to order by a column the view does not have, which is a 400 rather
  // than a smaller answer. It only bit when a caller passed params at all: with
  // none this function returns before reaching here, so the taken-slots call —
  // the one case that always passes a date filter — was the one that broke.
  if (order !== undefined || !opts?.noDefaultOrder) {
    sp.set("order", `${order ?? "id"}.${dir === "asc" ? "asc" : "desc"}`);
  }
  // Full-text search, when the table declared it. `fts` is the generated tsvector
  // column the schema engine creates.
  if (q) sp.set("_fts", `fts.${q}`);
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, `eq.${v}`);
  }
  return "?" + sp.toString();
}

const idFilter = (id: RowId) => `?id=eq.${encodeURIComponent(String(id))}`;

/**
 * A refusal the database raised, said in a sentence a visitor can act on.
 *
 * This exists because of what changed when reads moved to the Data API. The
 * platform's own routes used to write the message — a double booking answered
 * "That time is already taken" — and PostgREST instead returns the Postgres error
 * verbatim, so the same refusal now reads:
 *
 *   conflicting key value violates exclusion constraint "ex_appointments_nooverlap"
 *
 * That is what a barber shop's customer saw, measured in the runtime test rather
 * than reasoned about. So the SQLSTATE is translated here, in the one place every
 * read and write already passes through — the generator never writes error
 * handling, and a page that did would get this wrong per-form.
 *
 * Only codes a VISITOR can actually provoke are listed. Anything else keeps the
 * server's own text, which matters for `P0001`: that is what our schema triggers
 * raise, and their messages ("row limit reached", "missing parent", the
 * transition and SLA rules) are ours already and are worth showing as written.
 */
function humanPgError(code: string | undefined, details?: string): string | null {
  // `Key (email)=(a@b.com) already exists.` — naming the field turns "that's
  // taken" into something the visitor can fix. Guarded, and it simply does not
  // fire when the shape is anything else.
  const col = (details || "").match(/^Key \(([a-z0-9_]{1,40})\)=/i)?.[1]?.replace(/_/g, " ");
  switch (code) {
    // An `EXCLUDE` constraint — what `noOverlap` compiles to. Always a booking
    // colliding with one already in the book.
    case "23P01": return "That time has just been taken. Please pick another.";
    case "23505": return col ? `That ${col} is already taken.` : "That has already been submitted.";
    case "23503": return "That option isn't available any more — please pick another.";
    case "23514": return "Some of those details aren't valid. Please check and try again.";
    case "23502": return "Something required was left out. Please check the form.";
    case "22P02": case "22007": case "22003":
      return "Some of those details aren't in the right format.";
    // Postgres names the table it refused; a stranger has no business learning
    // that, and it tells the visitor nothing either way.
    case "42501": case "42P01": case "42703":
      return "That isn't available.";
    default: return null;
  }
}

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  // The member's session, when there is one. Sent on every call: a `user` table's
  // RLS policy answers with no rows without it, and that member's own rows with it.
  // THE DATA API WANTS THE JWT, not the bearer token the auth server wants.
  const token = getJwt();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // PostgREST reports the caller's fault in `message`, with `code` carrying the
    // Postgres SQLSTATE — 23505 is a duplicate, 23514 a failed check. The SQLSTATE
    // is the useful part: the message beside it is written for a DBA, so the ones
    // a visitor can trigger get a sentence instead. `code` is still attached, so a
    // form that wants to handle a specific failure itself still can.
    const b = body as { message?: string; details?: string; code?: string } | null;
    const err = new Error(
      humanPgError(b?.code, b?.details) || b?.message || b?.details || `request failed (${res.status})`,
    );
    (err as Error & { code?: string; status: number }).code = b?.code;
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return body as T;
}

/**
 * A table's rows. `data` IS the array — PostgREST answers a list with the array
 * itself, and every list hook here unwraps the same way so none is the odd one out.
 *
 * `Row` IS THE DEFAULT AND IS NOT THE CONSTRAINT — this and the three hooks below
 * were `<T extends Row = Row>` until 2026-08-04, and that constraint refused the
 * most ordinary thing a TypeScript author writes:
 *
 *     interface Booking { id: number; starts_at: string }
 *     useRows<Booking>("bookings")   // TS2344: does not satisfy 'Row'
 *
 * Every field is present and it is still refused, because `Row` intersects
 * `Record<string, unknown>` and an INTERFACE gets no implicit index signature
 * where a type alias does. So whether a page compiled turned on a keyword that
 * has nothing to do with the data. Measured live: a build fell back to the
 * placeholder on exactly this, `index.tsx(57,25) TS2344 'PublicBooking'`.
 *
 * It also refused a caller declaring only the columns they render — honest,
 * ordinary, and a compile error.
 *
 * Nothing here indexes into `T`; it is the shape of what comes back and, in
 * `useUpdateRow`, of what goes out. The constraint bought the implementation
 * nothing and cost the caller a page. This is the same fix, for the same reason,
 * that `usePublicRows` got — see `PublicRow` above. Asking for a table the
 * visitor may not read is still caught, by the lint, which says so in words.
 */
export function useRows<T = Row>(
  table: string,
  params?: RowQuery,
  options?: Omit<UseQueryOptions<T[]>, "queryKey" | "queryFn">,
) {
  return useQuery<T[]>({
    queryKey: ["rows", siteSlug(), table, params ?? {}],
    queryFn: () => send<T[]>(base(table) + pgQuery(params)),
    ...options,
  });
}

/** One row by id, or null. `undefined` id disables the query. */
export function useRow<T = Row>(table: string, id: RowId | undefined) {
  return useQuery<T | null>({
    queryKey: ["row", siteSlug(), table, id],
    enabled: id !== undefined && id !== null && id !== "",
    queryFn: () => send<T[]>(base(table) + idFilter(id as RowId) + "&select=*").then((r) => r[0] ?? null),
  });
}

/**
 * Submit a row. Resolves to NOTHING, and that is not a limitation — it is the
 * only thing a write-only table can do.
 *
 * IT ASKED FOR THE ROW BACK AND THAT REFUSED EVERY SUBMISSION ON EVERY SITE.
 * Measured live 2026-08-04: a generated barber shop's booking form answered
 * `403` to its own customer. The chain is exact and it is not a bug in any one
 * of its links:
 *
 *   - a `collect` table is write-only BY DESIGN — an INSERT policy and an INSERT
 *     grant, and deliberately NO SELECT policy and no SELECT grant, so that
 *     customer names and phone numbers can never be listed by a stranger;
 *   - `Prefer: return=representation` makes PostgREST run `INSERT … RETURNING`;
 *   - RETURNING needs SELECT.
 *
 * So the one header that made a confirmation screen possible is the one that
 * made the insert impossible, on precisely the tables every contact form and
 * every booking form uses. Reads were fine, which is why it looked like the
 * database was up: `bookings_public` and `services` both answered 200 while the
 * POST beside them was refused.
 *
 * The header is gone. PostgREST answers 201 with an empty body, `send` hands
 * back null, and the mutation resolves `void` — so a page that tries to read the
 * created row now fails at `tsc` rather than in front of a customer. That is the
 * whole reason this returns void instead of `T | undefined`: the honest type is
 * the one that cannot be silently wrong at runtime.
 *
 * `useUpdateRow` KEEPS the header on purpose — PATCH is only ever granted on
 * `user`/`feed` tables, where the caller does have SELECT, so RETURNING is legal
 * there. `collect` has no UPDATE grant at all and 403s whatever it sends.
 *
 * The type parameter is kept, unused, so a page written as
 * `useCreateRow<Booking>("bookings")` still compiles.
 *
 * Never annotate the mutation callback's parameter. TanStack's callback takes four
 * arguments and its types are contravariant, so a hand-written annotation is
 * refused even when it looks right.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useCreateRow<T = Row>(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>): Promise<void> => {
      try {
        await send<unknown>(base(table), {
          method: "POST",
          body: JSON.stringify(challenged(values)),
        });
      } finally {
        resetChallenge();
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rows", siteSlug(), table] }); },
  });
}

/** One line of a basket. The ONLY two things a page may decide about money. */
export type CartLine = { id: RowId; qty?: number };

/**
 * Send the visitor to Stripe to pay for a basket.
 *
 * The page NEVER sends a price, a total or a currency, and there is nowhere in
 * this type to put one. The server reads the prices out of the site's own
 * catalogue table and computes the total there, so a basket edited in the
 * browser cannot change what is charged.
 *
 * `fields` is the customer's own details — name, email, address — and only the
 * columns the table declared are kept. The payment columns are not among them.
 *
 * On success this REDIRECTS to Stripe, so nothing after `mutate` runs. Success
 * and cancel both come back to the site's own root with `?paid=` or
 * `?cancelled=` and the order id, which is what a thank-you page should read.
 * That id is NOT proof of payment — anyone can type it — so a page must never
 * treat it as more than "show a friendly message"; the order is marked paid by
 * the shop's Stripe calling the platform, not by the browser coming back.
 */
export function useCheckout(table: string) {
  return useMutation({
    mutationFn: async (input: { items: CartLine[]; fields?: Record<string, string> }): Promise<void> => {
      const res = await fetch(`/api/db/${siteSlug()}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ table, items: input.items, fields: input.fields ?? {} }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        // The server's sentence is written for the customer ("this shop hasn't
        // finished setting up payments yet"), so it is shown rather than
        // replaced with a generic one.
        throw new Error(data?.error || "We couldn't start that payment.");
      }
      window.location.href = data.url as string;
    },
  });
}

/**
 * What `useUpdateRow` accepts: the columns bare, or nested under `values`.
 *
 * `Omit<Partial<T>, "id">` is still required in both branches with T
 * unconstrained: whenever T DOES carry an id — the `Row` default, and any row
 * type a page writes — `Partial<T>` carries `id?: number` and intersecting
 * narrows RowId straight back to number, which is the third of the three errors
 * that made every edit page a placeholder on 2026-07-29.
 */
export type UpdateArg<T> = { id: RowId } & (Omit<Partial<T>, "id"> | { values: Omit<Partial<T>, "id"> });

/** Edit a row. Only reaches rows the site's policies let this member reach. */
export function useUpdateRow<T = Row>(table: string) {
  const qc = useQueryClient();
  return useMutation({
    // Omit<Partial<T>, "id"> is still required with T unconstrained: whenever T
    // DOES carry an id — the `Row` default, and any row type a page writes —
    // `Partial<T>` carries `id?: number` and intersecting narrows RowId straight
    // back to number, which is the third of the three errors that made every
    // edit page a placeholder on 2026-07-29.
    // BOTH SHAPES, for the reason its sibling one function below already takes
    // both: the generator reaches for the other one and a compile error here
    // costs the whole page.
    //
    // `useCreateRow` takes the columns bare (`create.mutate(values)`), so
    // `{ id, values: {...} }` is the natural guess for an edit — and it is what
    // the eval recorded FOUR times in five runs, as
    // `Type '{ stage: string; }' is not assignable to 'string | number | boolean
    // | null | undefined'`: `values` was read as a column name and typechecked
    // against a row value. Nothing in the rules ever showed the correct call.
    //
    // A UNION, not an intersection with an optional `values`. `T` carries an
    // index signature, so `{ values?: … } & Omit<Partial<T>, "id">` intersects
    // that property with the row-value union and makes it uncallable — which is
    // the very error being fixed.
    mutationFn: (arg: UpdateArg<T>) => {
      const { id } = arg;
      const nested = (arg as { values?: Omit<Partial<T>, "id"> }).values;
      const { id: _drop, values: _drop2, ...rest } = arg as Record<string, unknown>;
      void _drop; void _drop2;
      return send<T[]>(base(table) + idFilter(id), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(nested && typeof nested === "object" ? nested : rest),
      }).then((r) => r[0]);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rows", siteSlug(), table] }); },
  });
}

/** Delete a row. Accepts a bare id or `{ id }`, because its sibling takes an object. */
export function useDeleteRow(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: RowId | { id: RowId }) => {
      const id = typeof arg === "object" && arg !== null ? arg.id : arg;
      return send<void>(base(table) + idFilter(id), { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rows", siteSlug(), table] }); },
  });
}

/**
 * A function the site's own schema defines, called by name.
 *
 * This is the interesting half of moving to the Data API. Anything the database
 * can express and a policy cannot — reaching into a write-only table for exactly
 * one row, a report across several tables, a booking's remaining slots — is a
 * Postgres function, exposed here. It replaces a list of hand-built verbs with
 * "whatever the schema declared".
 */
export function useRpc<T = unknown>(fn: string, args?: Record<string, unknown>) {
  return useQuery<T>({
    queryKey: ["rpc", siteSlug(), fn, args ?? {}],
    queryFn: () => send<T>(`/api/db/${siteSlug()}/data/rpc/${fn}`, {
      method: "POST",
      body: JSON.stringify(args ?? {}),
    }),
  });
}

/** The same, as an action rather than a read. */
export function useRpcAction<T = unknown>(fn: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args?: Record<string, unknown>) =>
      send<T>(`/api/db/${siteSlug()}/data/rpc/${fn}`, { method: "POST", body: JSON.stringify(args ?? {}) }),
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

/**
 * Read a third-party API the site declared.
 *
 * Live data that is not in this site's database and is not fixed at build time:
 * today's exchange rate, a courier's delivery slots, a supplier's stock level.
 * The request itself — url, headers, which secret goes where — is declared in
 * the schema and performed by the platform, because the key cannot be in this
 * bundle: these files are public on a CDN.
 *
 * So the answer comes back EXACTLY as that service sent it. There is no
 * envelope of ours around it and no shape imposed on it; write the page against
 * the service's real response.
 *
 * `params` are only the names the declaration listed. Anything else is dropped
 * rather than forwarded — a page may change the postcode, never the host.
 */
export function useApi<T = unknown>(name: string, params?: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null) qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs}` : "";
  return useQuery<T>({
    queryKey: ["api", siteSlug(), name, params ?? {}],
    queryFn: () => send<T>(`/api/db/${siteSlug()}/api/${name}${suffix}`),
    // The platform already caches by the window the declaration asked for, so a
    // second identical read here costs nothing upstream either way. This just
    // stops a remount refetching something the page already has.
    staleTime: 30_000,
  });
}

// ── Visitor accounts ────────────────────────────────────────────────────────
//
// The site's own members — a barber shop's customers — nothing to do with isibi
// accounts. Identity is Neon Auth (managed Better Auth) as of 2026-07-30, living
// in the site's own database, and every call here goes through the platform at
// `/api/db/<slug>/auth/*` rather than to the auth server directly. That is
// same-origin, so there is no CORS and no cross-site cookie, and the page never
// holds an endpoint or a key.
//
// A session is a bearer token kept in localStorage and sent on every read. Tables
// at access `user` are private per member; `feed` and `admin` are readable to
// anyone signed in.

const TOKEN_KEY = () => `site_session_${siteSlug()}`;
const JWT_KEY = () => `site_jwt_${siteSlug()}`;

export function getSessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY()); } catch { return null; }
}
function setSessionToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY(), token) : localStorage.removeItem(TOKEN_KEY()); } catch { /* private mode */ }
}

/**
 * TWO TOKENS, BECAUSE THE TWO SERVERS WANT DIFFERENT THINGS — and getting this
 * wrong made member accounts impossible on every generated site.
 *
 * The AUTH server takes Better Auth's bearer token, which arrives in the
 * `set-auth-token` RESPONSE HEADER of a sign-in ("After a successful sign-in,
 * you'll receive a session token in the response headers"). The body's `token`
 * field is a different value: sending it got `200` with a null session, so a
 * signed-in visitor read as signed out.
 *
 * The DATA API takes a JWT, which arrives in the `set-auth-jwt` response header
 * of `get-session` ("copy the JWT from the Set-Auth-Jwt response header"). A
 * bearer token is not a JWT — sending it got `400 not a valid JWT encoding`, so
 * every `user`, `feed` and `admin` read and write failed.
 *
 * Both were measured live on 2026-08-04 and then confirmed against the two
 * vendors' own documentation rather than guessed at.
 *
 * The JWT is refreshed every time `useMember()` refetches, which is what a page
 * showing member content does anyway. It is deliberately NOT read from
 * localStorage on the auth path: an expired JWT there must not outlive the
 * session it came from.
 */
function getJwt(): string | null {
  try { return localStorage.getItem(JWT_KEY()); } catch { return null; }
}
function setJwt(token: string | null) {
  try { token ? localStorage.setItem(JWT_KEY(), token) : localStorage.removeItem(JWT_KEY()); } catch { /* private mode */ }
}
/** Whichever of the two headers a response carries, kept. */
function keepAuthHeaders(r: Response) {
  const bearer = r.headers.get("set-auth-token");
  if (bearer) setSessionToken(bearer);
  const jwt = r.headers.get("set-auth-jwt");
  if (jwt) setJwt(jwt);
}

export type Member = {
  id: string;
  email: string;
  name: string;
  /**
   * "user" or "admin", plus whatever this site's tables named in `writeRoles`.
   * A member who has never been granted anything is "user". Gate admin UI on
   * this — an `admin` table refuses a write from any other role with a 403.
   */
  role: string;
  verified: boolean;
};

const authUrl = (action: string) => `/api/db/${siteSlug()}/auth/${action}`;

/**
 * Better Auth answers a sign-in with a session object; the token inside it is
 * what every later request carries. Pulled out in ONE place, because the shape
 * appears in sign-up and sign-in both and two readers of it drift.
 */
function tokenOf(d: unknown): string | null {
  const o = d as { token?: unknown; session?: { token?: unknown } } | null;
  const t = o?.token ?? o?.session?.token;
  return typeof t === "string" && t ? t : null;
}

function memberOf(d: unknown): Member | null {
  const o = d as { user?: Record<string, unknown> } | null;
  const u = o?.user;
  if (!u || typeof u !== "object") return null;
  return {
    id: String(u.id ?? ""),
    email: String(u.email ?? ""),
    name: String(u.name ?? ""),
    role: String(u.role ?? "user").toLowerCase(),
    verified: !!u.emailVerified,
  };
}

/**
 * The signed-in member, or null. `isPending` while it is being checked — render
 * NEITHER view until it settles, or the page flashes a sign-in form at somebody
 * who is already signed in.
 */
export function useMember() {
  const token = getSessionToken();
  return useQuery({
    queryKey: ["member", siteSlug(), token],
    queryFn: async (): Promise<Member | null> => {
      if (!token) return null;
      const r = await fetch(authUrl("get-session"), { headers: { Authorization: `Bearer ${token}` } });
      // THE JWT ARRIVES HERE, in a response header, and this is the only call
      // that produces one. Every data read the page makes afterwards carries it.
      keepAuthHeaders(r);
      // A token the server no longer accepts is cleared here rather than left to
      // fail every subsequent read with a 401 the page cannot explain.
      if (r.status === 401) { setSessionToken(null); setJwt(null); return null; }
      if (!r.ok) throw new Error("could not check your sign-in");
      return memberOf(await r.json().catch(() => null));
    },
    retry: false,
    staleTime: 30_000,
  });
}

function useAuthAction(action: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const r = await fetch(authUrl(action), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        const msg = (d as { message?: string; error?: string } | null);
        throw new Error(msg?.message || msg?.error || "that did not work");
      }
      // THE HEADER FIRST. Better Auth's bearer plugin answers a sign-in with the
      // token in `set-auth-token`, and that is what `get-session` accepts; the
      // body's `token` is a different value and using it returned a null session
      // — a signed-in visitor who reads as signed out.
      //
      // The body is still read as a fallback, because it costs nothing and a
      // deployment without the bearer plugin would answer only that way.
      keepAuthHeaders(r);
      const t = tokenOf(d);
      // Stored only when there IS one. Writing `undefined` would leave the page
      // believing it is signed in with a session nothing accepts.
      if (t && !r.headers.get("set-auth-token")) setSessionToken(t);
      return d;
    },
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

/** `{ email, password, name }`. Passwords need 8+ characters. */
export function useSignup() { return useAuthAction("sign-up/email"); }
/** `{ email, password }`. */
export function useLogin() { return useAuthAction("sign-in/email"); }

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = getSessionToken();
      // Told to the server as well as forgotten locally, or the session stays
      // live for anyone who kept a copy of the token.
      if (token) {
        // A BODY AND A CONTENT-TYPE, or the auth server answers 415 before it
        // looks at anything else. Measured live 2026-08-04: sign-out was a POST
        // with neither, so it failed on every generated site — and because the
        // failure is swallowed (deliberately: the local token is cleared either
        // way), the page believed it had signed out while the session stayed
        // live for anyone holding a copy of the token.
        await fetch(authUrl("sign-out"), {
          method: "POST",
          headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
          body: "{}",
        }).catch(() => {});
      }
      setSessionToken(null);
      setJwt(null);
    },
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

/**
 * `{ email }`. Always succeeds — tell the visitor to check their inbox whether or
 * not the address has an account, because saying which would confirm who is a
 * member here.
 */
export function useRequestReset() {
  return useMutation({
    mutationFn: async (values: { email: string }) => {
      await fetch(authUrl("forget-password"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      }).catch(() => {});
      return { ok: true as const };
    },
  });
}

// ── Attaching a picture ──────────────────────────────────────────────────────
//
// A file column is an ordinary TEXT column holding a URL. The flow is: upload
// the file, get a URL back, put that URL in the form value, submit the row as
// normal. There is no multipart row write and there is no "file field" — the
// row is still plain JSON.
//
// The endpoint only accepts a file for a table a visitor can write to that also
// declares somewhere to put it, so a form of six text fields cannot upload at
// all. Getting a 403 here means the schema has no image column, not that the
// visitor did something wrong.

export type UploadResult = { url: string; name: string; size: number; mime: string };

/**
 * Upload one picture for `table` and resolve to its URL.
 *
 * Raw bytes, not multipart or base64: the server decides the type from the
 * leading bytes regardless of what is declared, and base64 would inflate a
 * phone photo by a third for nothing.
 */
export async function uploadFile(table: string, file: File): Promise<UploadResult> {
  const res = await fetch(`/api/db/${siteSlug()}/uploads?table=${encodeURIComponent(table)}`, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; url?: string } & UploadResult;
  if (!res.ok || !body.url) {
    const err = new Error(body.error || `upload failed (${res.status})`);
    (err as Error & { code?: string; status: number }).code = body.code;
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return body;
}

/**
 * The same, as a mutation, so a form can show progress and an error the way it
 * does for every other write.
 */
export function useUploadFile(table: string) {
  return useMutation({
    mutationFn: (file: File) => uploadFile(table, file),
  });
}

// ── The public view ─────────────────────────────────────────────────────────
//
// Some tables publish a named, PII-filtered projection that anyone may read,
// even though the table itself is not readable. The case it exists for is a
// booking page: it needs to know WHICH SLOTS ARE TAKEN without learning
// anything about who took them.
//
// Only tables whose schema declares `publicView` have one — asking for it on a
// table that does not is a 404, not an error worth surfacing.

/**
 * A publicly-readable view of a table that is not itself readable.
 *
 * The case it exists for: a booking form is write-only, and the page still needs
 * to grey out the slots somebody has already taken. Under RLS there is no "public
 * projection" setting — the site's schema declares a VIEW or a function that
 * publishes only the columns it means to (`when`, never `who`), and this reads it
 * by name. Rows have no `id`: publishing a sequential id from an owner-scoped
 * table tells a stranger how many bookings exist. Key on a published column.
 */
export function usePublicRows<T = PublicRow>(table: string, params?: RowQuery) {
  // THE ARGUMENT IS THE TABLE; THE REQUEST GOES TO THE VIEW.
  //
  // A projection cannot be served from the table — the table is `collect` or
  // `user`, so RLS gives a stranger no SELECT policy on it, which is the whole
  // point. The schema engine creates `<table>_public` beside it and grants that.
  //
  // This hook used to fetch the table verbatim, back when nothing created the
  // view at all: measured live 2026-08-04, a generated barber shop asked its own
  // database for today's bookings on its own home page and got 403.
  //
  // The suffix is duplicated from `site-access.mjs`'s `publicViewName` because
  // this is a separate bundle and cannot import it. A test reads both files and
  // fails if they ever disagree — a disagreement is a 403 on a published site.
  const view = table + "_public";
  return useQuery<T[]>({
    queryKey: ["public", siteSlug(), view, params ?? {}],
    queryFn: () => send<T[]>(base(view) + pgQuery(params, { noDefaultOrder: true })),
  });
}

/**
 * One submission, read back by the person who made it.
 *
 * A `collect` table is write-only — no policy lets anyone list it — so this is the
 * single exception, and it opens exactly one row. The site's schema declares a
 * `SECURITY DEFINER` function that takes the row's claim token and returns the
 * matching row; that function bypasses RLS deliberately and by name, which is a
 * far narrower hole than a read policy would be.
 *
 * Put the token in the link you send ("manage your booking") and read it off the
 * URL here. A wrong token returns nothing, exactly like a row that is not there.
 */
export function useClaimedRow<T = Row>(fn: string, claim: string | undefined) {
  return useQuery<T | null>({
    enabled: !!claim,
    queryKey: ["claim", siteSlug(), fn, claim],
    queryFn: () => send<T[]>(`/api/db/${siteSlug()}/data/rpc/${fn}`, {
      method: "POST",
      body: JSON.stringify({ tok: claim }),
    }).then((r) => (Array.isArray(r) ? r[0] ?? null : (r as unknown as T))),
  });
}

/** Cancel that same submission, through the function the schema declared for it. */
export function useCancelClaim(fn: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ claim }: { claim: string }) =>
      send<unknown>(`/api/db/${siteSlug()}/data/rpc/${fn}`, { method: "POST", body: JSON.stringify({ tok: claim }) }),
    onSuccess: () => { qc.invalidateQueries(); },
  });
}

/**
 * CHANGE that submission — move the appointment rather than binning it.
 *
 * The gap this closes: a claim link could read and cancel, and nothing else. So
 * "move my Tuesday cut to Thursday" meant cancelling and booking again, typing
 * everything back in — and on a site whose booking table has a `unique` or
 * `noOverlap` constraint, giving up the slot before securing the new one.
 *
 * It is the SAME endpoint and the same shape as the other two: a
 * `SECURITY DEFINER` function named by the schema, taking the token plus
 * whatever it lets the customer change. That is what keeps this safe — the
 * function decides which columns move, so a page cannot reach a column the
 * business never meant to expose, and the constraints re-run inside the UPDATE
 * exactly as they did on the insert.
 *
 * `values` are the function's OWN argument names, not column names — they
 * happen to match on most sites, and the function is what decides.
 */
export function useAmendClaim(fn: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ claim, values }: { claim: string; values: Record<string, unknown> }) =>
      send<unknown>(`/api/db/${siteSlug()}/data/rpc/${fn}`, {
        method: "POST",
        // The token FIRST, then the caller's fields — so a `values` carrying its
        // own `tok` cannot overwrite the one that proves who is asking.
        body: JSON.stringify({ tok: claim, ...values }),
      }),
    onSuccess: () => { qc.invalidateQueries(); },
  });
}
