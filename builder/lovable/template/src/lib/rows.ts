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

export type Row = Record<string, unknown> & { id: number };

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
export type PublicRow = Record<string, unknown>;

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
  const fromPath = window.location.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]*)/i);
  if (fromPath) return fromPath[1].toLowerCase();
  return (import.meta as { env?: Record<string, string> }).env?.VITE_SITE_SLUG ?? "preview";
}

// ── Talking to the database ─────────────────────────────────────────────────
//
// Rows come from the site's own Neon Data API, which is PostgREST — so a filter is
// `?col=eq.value`, a sort is `?order=col.desc`, and an insert asks for the row back
// with a `Prefer` header. The platform's own row routes were deleted 2026-07-30;
// these paths forward to Neon and nothing more, and the site's RLS policies decide
// every access question.
//
// The generator never writes any of this. It calls a hook and names a table.

const base = (table: string) => `/api/db/${siteSlug()}/data/${table}`;

/** PostgREST's equality filter, and the query shape a list read accepts. */
function pgQuery(params?: RowQuery): string {
  const sp = new URLSearchParams();
  sp.set("select", "*");
  if (!params) return "?" + sp.toString();
  const { limit, offset, order, dir, q, ...filters } = params;
  if (limit !== undefined) sp.set("limit", String(limit));
  if (offset !== undefined) sp.set("offset", String(offset));
  // Newest first by default: these are usually submissions or posts, and the
  // useful one is the latest.
  sp.set("order", `${order ?? "id"}.${dir === "asc" ? "asc" : "desc"}`);
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
  const token = (() => { try { return localStorage.getItem(`site_session_${siteSlug()}`); } catch { return null; } })();
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
 * Submit a row. Resolves to the created row.
 *
 * `Prefer: return=representation` is what makes it come back at all — without it
 * PostgREST answers 201 with an empty body, and a page that shows "thanks, here is
 * your booking" has nothing to show.
 *
 * Never annotate the mutation callback's parameter. TanStack's callback takes four
 * arguments and its types are contravariant, so a hand-written annotation is
 * refused even when it looks right.
 */
export function useCreateRow<T = Row>(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      send<T[]>(base(table), {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(values),
      }).then((r) => r[0]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rows", siteSlug(), table] }); },
  });
}

/** Edit a row. Only reaches rows the site's policies let this member reach. */
export function useUpdateRow<T = Row>(table: string) {
  const qc = useQueryClient();
  return useMutation({
    // Omit<Partial<T>, "id"> is still required with T unconstrained: whenever T
    // DOES carry an id — the `Row` default, and any row type a page writes —
    // `Partial<T>` carries `id?: number` and intersecting narrows RowId straight
    // back to number, which is the third of the three errors that made every
    // edit page a placeholder on 2026-07-29.
    mutationFn: ({ id, ...values }: { id: RowId } & Omit<Partial<T>, "id">) =>
      send<T[]>(base(table) + idFilter(id), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(values),
      }).then((r) => r[0]),
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

export function getSessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY()); } catch { return null; }
}
function setSessionToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY(), token) : localStorage.removeItem(TOKEN_KEY()); } catch { /* private mode */ }
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
      // A token the server no longer accepts is cleared here rather than left to
      // fail every subsequent read with a 401 the page cannot explain.
      if (r.status === 401) { setSessionToken(null); return null; }
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
      const t = tokenOf(d);
      // Stored only when there IS one. Writing `undefined` would leave the page
      // believing it is signed in with a session nothing accepts.
      if (t) setSessionToken(t);
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
        await fetch(authUrl("sign-out"), { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
      setSessionToken(null);
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
export function usePublicRows<T = PublicRow>(view: string, params?: RowQuery) {
  return useQuery<T[]>({
    queryKey: ["public", siteSlug(), view, params ?? {}],
    queryFn: () => send<T[]>(base(view) + pgQuery(params)),
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
