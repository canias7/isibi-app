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
export function useRow<T extends Row = Row>(table: string, id: number | undefined) {
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
      send<{ row: T }>(base(table), { method: "POST", body: JSON.stringify(values) }),
    onSuccess: invalidate,
  });
}

export function useUpdateRow<T extends Row = Row>(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: ({ id, ...values }: Partial<T> & { id: number }) =>
      send<{ row: T }>(`${base(table)}/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
    onSuccess: invalidate,
  });
}

export function useDeleteRow(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: (id: number) => send<{ ok: true }>(`${base(table)}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

// ── Visitor accounts ────────────────────────────────────────────────────────
//
// The site's own members — a barber shop's customers — not isibi accounts. A
// session is a signed token from /api/db/<slug>/auth/*, kept in localStorage and
// sent as a Bearer header on every call. Tables at access `user` are private per
// member; `feed` and `admin` are readable to anyone signed in.

const TOKEN_KEY = () => `site_session_${siteSlug()}`;

export function getSessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY()); } catch { return null; }
}
function setSessionToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY(), token) : localStorage.removeItem(TOKEN_KEY()); } catch { /* private mode */ }
}

export type Member = { id: number; email: string };

const authUrl = (action: string) => `/api/db/${siteSlug()}/auth/${action}`;

/**
 * The signed-in member, or null. `isPending` while it is being checked — render
 * neither the signed-in nor the signed-out view until it settles, or the page
 * flashes a login form at somebody who is already logged in.
 */
export function useMember() {
  const token = getSessionToken();
  return useQuery({
    queryKey: ["member", token],
    // Nothing to ask about when there is no token; resolve to null immediately.
    queryFn: async (): Promise<Member | null> => {
      if (!token) return null;
      try {
        const r = await send<{ user: Member }>(authUrl("me"), { headers: { Authorization: `Bearer ${token}` } });
        return r.user;
      } catch {
        // A rejected token is spent — a month-old session, or an account since
        // removed. Clear it so the page offers a fresh login instead of looping.
        setSessionToken(null);
        return null;
      }
    },
    staleTime: 60_000,
  });
}

function useAuthAction(action: "signup" | "login") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { email: string; password: string }) =>
      send<{ token: string; user: Member }>(authUrl(action), { method: "POST", body: JSON.stringify(values) }),
    onSuccess: (d) => {
      setSessionToken(d.token);
      // Every read changes meaning once there is a session — a `user` table goes
      // from 401 to that member's own rows.
      qc.invalidateQueries();
    },
  });
}

export const useSignup = () => useAuthAction("signup");
export const useLogin = () => useAuthAction("login");

export function useLogout() {
  const qc = useQueryClient();
  return () => { setSessionToken(null); qc.invalidateQueries(); };
}

/** Ask for a reset link. Always succeeds, whether or not the address has an account. */
export function useRequestReset() {
  return useMutation({
    mutationFn: (values: { email: string }) =>
      send<{ ok: true }>(authUrl("reset"), { method: "POST", body: JSON.stringify(values) }),
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
