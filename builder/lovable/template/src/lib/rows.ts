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
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
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
