// Data access for a generated site.
//
// The generator should never write fetch code — it calls these hooks and names
// a table. Everything else (where the site lives, how rows are shaped, how the
// cache is invalidated after a write) is handled here once.
//
// The API is the platform's: /api/db/<slug>/rows/<table>. Only tables declared
// `access: "public"` in isibi.schema.json are reachable; an owner-scoped table
// returns 403 until visitor accounts exist.
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

const base = (table: string) => `/api/db/${siteSlug()}/rows/${table}`;

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  // The member's session, when there is one. Sent on every call: a `user` table
  // answers 401 without it and that member's own rows with it.
  const token = (() => { try { return localStorage.getItem(`site_session_${siteSlug()}`); } catch { return null; } })();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The API distinguishes the caller's fault from a server fault, so surface
    // its message and code rather than a generic failure.
    const err = new Error((body as { error?: string }).error || `request failed (${res.status})`);
    (err as Error & { code?: string; status: number }).code = (body as { code?: string }).code;
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return body as T;
}

function qs(params?: RowQuery): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Rows from one table. Re-runs whenever `params` changes. */
export function useRows<T extends Row = Row>(
  table: string,
  params?: RowQuery,
  options?: Omit<UseQueryOptions<{ rows: T[] }, Error, T[]>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: ["rows", table, params ?? {}],
    queryFn: () => send<{ rows: T[] }>(base(table) + qs(params)),
    select: (d) => d.rows,
    ...options,
  });
}

/** One row by id, read from the list endpoint so it obeys the same rules. */
export function useRow<T extends Row = Row>(table: string, id: RowId | undefined) {
  return useQuery({
    queryKey: ["row", table, id],
    enabled: id !== undefined,
    queryFn: () => send<{ rows: T[] }>(base(table) + qs({ id })),
    select: (d) => d.rows[0],
  });
}

/** Invalidate every cached read of a table after it changes. */
function useInvalidate(table: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["rows", table] });
    qc.invalidateQueries({ queryKey: ["row", table] });
  };
}

export function useCreateRow<T extends Row = Row>(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: (values: Partial<T>) =>
      // `claim` comes back only for a `collect` table: a signed token for THIS
      // row, and the only time it is ever issued. Keep it (a link, an email, the
      // thank-you page) and the person who submitted can come back to their own
      // submission — see useClaimedRow. Optional because no other access level
      // mints one.
      send<{ row: T; claim?: string }>(base(table), { method: "POST", body: JSON.stringify(values) }),
    onSuccess: invalidate,
  });
}

export function useUpdateRow<T extends Row = Row>(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    // `Omit<…, "id">` is load-bearing: `Partial<T>` already carries `id?: number`
    // from `Row`, and intersecting narrows RowId straight back to `number` — so
    // a string id was still refused, which is the TS2322 production hit on the
    // members page even after the other signatures were widened.
    mutationFn: ({ id, ...values }: Omit<Partial<T>, "id"> & { id: RowId }) =>
      send<{ row: T }>(`${base(table)}/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: invalidate,
  });
}

export function useDeleteRow(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    // Accepts a bare id OR `{ id }`. `useUpdateRow` takes an object, so a caller
    // reasonably assumes its sibling does too — the generator passed `{ id }`
    // here and it was a type error, in a sample that was otherwise correct.
    // Cheaper to accept both than to be the exception nobody expects.
    mutationFn: (arg: RowId | { id: RowId }) => {
      const id = typeof arg === "object" && arg !== null ? arg.id : arg;
      return send<{ ok: true }>(`${base(table)}/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
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
 * Read a table's declared public projection.
 *
 * `params` may filter, but only on the columns the projection itself publishes;
 * anything else is ignored by the API rather than honoured, so this cannot be
 * used to ask about a column the site chose not to publish.
 */
export function usePublicRows<T = PublicRow>(table: string, params?: RowQuery) {
  return useQuery({
    queryKey: ["public", siteSlug(), table, params],
    queryFn: () => send<{ rows: T[] }>(`${base(table)}/public${qs(params)}`).then((r) => r.rows),
  });
}

/**
 * One submission, read back by the person who made it.
 *
 * A `collect` table is write-only — nobody can list it — so this is the single
 * exception, and it opens exactly one row: the `claim` handed back by
 * `useCreateRow` when that row was created. Put the token in the link you send
 * ("manage your booking") and read it off the URL here. A missing, wrong, or
 * expired token is a plain 404, the same as a row that isn't there.
 */
export function useClaimedRow<T extends Row = Row>(table: string, id: RowId | undefined, claim: string | undefined) {
  return useQuery({
    enabled: id !== undefined && !!claim,
    queryKey: ["claim", siteSlug(), table, id],
    queryFn: () =>
      send<{ row: T }>(`${base(table)}/${id}?claim=${encodeURIComponent(claim as string)}`).then((r) => r.row),
  });
}

/** Cancel that same submission. Safe to call twice — the second answers ok too. */
export function useCancelClaim(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: ({ id, claim }: { id: RowId; claim: string }) =>
      send<{ ok: true; cancelled: true }>(`${base(table)}/${id}?claim=${encodeURIComponent(claim)}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
