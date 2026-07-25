// useResource.ts — TEMPLATE. The one way a generated page talks to its backend.
//
// Every list page needs the same seven things: fetch, loading, error, create, update, delete, and a refresh
// after each write. Hand-written, that is ~40 lines of useState/useEffect per page — and the model got a
// different subset right each time. The commonest failure was silent: a create that worked but never refreshed
// the list, which looks EXACTLY like a broken save to the person using it.
//
//   const { data, loading, error, create, update, remove } = useResource('leads')
//
// The hook is the INTERFACE; TanStack Query underneath is the ENGINE — request dedup, caching, retries,
// in-flight race handling. Pages never see query keys or invalidateQueries, so a forgotten invalidation is
// not a bug they can write. If the engine is ever swapped out, only this file changes.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api.js'

export interface ResourceOptions {
  /** Query string sent with the list read — filters, sort, limit. `where` may be a single value or an array. */
  params?: Record<string, any>
  /** Skip the read until this is true (a detail page waiting on an id, a tab that is not open yet). */
  enabled?: boolean
  /** Send the signed-in user's token. On by default — `user`/`feed`/`admin` tables need it and public ones ignore it. */
  auth?: boolean
}

export interface Resource<Row = any> {
  /** The rows. Always an array — never null — so `data.map(…)` is safe on the first render. */
  data: Row[]
  /** Total matching rows on the server, which is larger than `data.length` when the read is paged. */
  total: number
  /** True only while there is nothing to show yet. A background refresh does NOT flip this back on. */
  loading: boolean
  error: Error | null
  /** True while a create/update/delete is in flight — wire it to the submit button's `disabled`. */
  saving: boolean
  create: (values: Partial<Row> | Record<string, any>) => Promise<any>
  update: (id: string | number, values: Partial<Row> | Record<string, any>) => Promise<any>
  remove: (id: string | number) => Promise<any>
  refetch: () => void
}

const qs = (params?: Record<string, any>) => {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)))
    else sp.append(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/**
 * useResource(table) — the full CRUD binding for one backend table.
 *
 *   const { data, loading, error, create, update, remove, saving } = useResource('bookings')
 *   const { data: mine } = useResource('bookings', { params: { where: 'status:eq:confirmed', limit: 20 } })
 *
 * The table must be declared in isibi.schema.json or every call 404s.
 */
export function useResource<Row = any>(table: string, options: ResourceOptions = {}): Resource<Row> {
  const { params, enabled = true, auth = true } = options
  const qc = useQueryClient()
  // The key carries the params, so two components reading the same table with different filters do not fight
  // over one cache entry — and a param change refetches on its own.
  const key = ['rows', table, params || null]
  const path = `/rows/${table}`

  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get(path + qs(params), { auth }),
    enabled: enabled && !!table,
  })

  // One invalidation point for all three writes. Prefix-matching `['rows', table]` refreshes EVERY filtered
  // view of this table, not just the one that happened to trigger the write.
  const done = () => qc.invalidateQueries({ queryKey: ['rows', table] })

  const create = useMutation({ mutationFn: (values: any) => api.post(path, values, { auth }), onSuccess: done })
  const update = useMutation({
    mutationFn: ({ id, values }: { id: string | number; values: any }) => api.patch(`${path}/${id}`, values, { auth }),
    onSuccess: done,
  })
  const remove = useMutation({ mutationFn: (id: string | number) => api.del(`${path}/${id}`, { auth }), onSuccess: done })

  return {
    data: (q.data && q.data.rows) || [],
    total: (q.data && q.data.total) ?? ((q.data && q.data.rows) || []).length,
    loading: q.isPending && enabled,
    error: (q.error as Error) || null,
    saving: create.isPending || update.isPending || remove.isPending,
    // mutateAsync (not mutate) so a page can `await create(...)` and catch a validation error from the server —
    // the server rejects bad writes with a 400 and a message, and the form must be able to show it.
    create: (values) => create.mutateAsync(values),
    update: (id, values) => update.mutateAsync({ id, values }),
    remove: (id) => remove.mutateAsync(id),
    refetch: () => { q.refetch() },
  }
}

/**
 * useRecord(table, id) — one row, for a detail page. Shares the same cache as useResource, so a write through
 * either one refreshes both.
 *
 *   const { id } = useParams()
 *   const { data: booking, loading } = useRecord('bookings', id)
 */
export function useRecord<Row = any>(table: string, id?: string | number | null, options: ResourceOptions = {}) {
  const { enabled = true, auth = true } = options
  const q = useQuery({
    queryKey: ['rows', table, 'one', String(id ?? '')],
    queryFn: () => api.get(`/rows/${table}/${id}`, { auth }),
    enabled: enabled && !!table && id !== undefined && id !== null && id !== '',
  })
  return {
    data: ((q.data && q.data.row) || null) as Row | null,
    loading: q.isPending && enabled && id != null,
    error: (q.error as Error) || null,
    refetch: () => { q.refetch() },
  }
}

export default useResource
