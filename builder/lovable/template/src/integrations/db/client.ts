// The per-app database client.
//
// Mirrors the ergonomics of the Supabase client Lovable's template ships — `db.from('bookings')
// .select().eq('status','confirmed')`, and `{ data, error }` on every result — because that is the
// shape a model reaches for by default. Underneath it is the isibi per-app REST API rather than
// Postgres, so the surface is deliberately narrower: only what the API can actually honour is here,
// and anything missing fails at compile time instead of returning silently wrong rows.
//
// Import it as:  import { db } from '@/integrations/db/client'

import type { Tables } from './types'

const API = '/api/db/' + (typeof location !== 'undefined' ? location.pathname.split('/')[2] || '' : '')
const TOKEN_KEY = 'isibi_site_token'

export interface Result<T> {
  data: T | null
  error: { message: string; status?: number; code?: string } | null
}

const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' } },
  set: (v: string) => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY) } catch {} },
}

async function request<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any) }
  const t = token.get()
  if (t) headers.Authorization = `Bearer ${t}`
  try {
    const res = await fetch(API + path, { ...init, headers })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      return { data: null, error: { message: body?.error || `Request failed (${res.status})`, status: res.status, code: body?.code } }
    }
    return { data: body as T, error: null }
  } catch {
    return { data: null, error: { message: 'Network error — check your connection and try again.' } }
  }
}

type Row<T extends string> = T extends keyof Tables ? Tables[T] : Record<string, any>

/**
 * A query builder. Chain filters, then await it.
 *   const { data, error } = await db.from('bookings').select().eq('status', 'confirmed').order('date')
 * Every operator here maps to one the server enforces; there is no client-side filtering, so a
 * large table stays cheap.
 */
class Query<T extends string> implements PromiseLike<Result<Row<T>[]>> {
  private params = new URLSearchParams()
  constructor(private table: T, private scope: 'rows' | 'public' = 'rows') {}

  /** Present for symmetry with the Supabase idiom; column projection is decided by the schema. */
  select() { return this }

  eq(column: string, value: unknown) { return this.where(column, 'eq', value) }
  ne(column: string, value: unknown) { return this.where(column, 'ne', value) }
  gt(column: string, value: unknown) { return this.where(column, 'gt', value) }
  gte(column: string, value: unknown) { return this.where(column, 'gte', value) }
  lt(column: string, value: unknown) { return this.where(column, 'lt', value) }
  lte(column: string, value: unknown) { return this.where(column, 'lte', value) }
  like(column: string, value: unknown) { return this.where(column, 'like', value) }

  private where(column: string, op: string, value: unknown) {
    this.params.append('where', `${column}:${op}:${String(value)}`)
    return this
  }

  /** `.order('date')` ascending, `.order('date', { ascending: false })` descending. */
  order(column: string, opts: { ascending?: boolean } = {}) {
    this.params.set('sort', (opts.ascending === false ? '-' : '') + column)
    return this
  }

  limit(n: number) { this.params.set('limit', String(n)); return this }
  offset(n: number) { this.params.set('offset', String(n)); return this }

  private path() {
    const qs = this.params.toString()
    const base = this.scope === 'public' ? `/rows/${this.table}/public` : `/rows/${this.table}`
    return qs ? `${base}?${qs}` : base
  }

  then<R1 = Result<Row<T>[]>, R2 = never>(
    onfulfilled?: ((v: Result<Row<T>[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return request<{ rows: Row<T>[] }>(this.path())
      .then((r) => ({ data: r.data ? (r.data.rows ?? (r.data as any)) : null, error: r.error }) as Result<Row<T>[]>)
      .then(onfulfilled, onrejected)
  }
}

class TableRef<T extends string> {
  constructor(private table: T) {}
  select() { return new Query(this.table) }
  insert(values: Partial<Row<T>>) { return request<Row<T>>(`/rows/${this.table}`, { method: 'POST', body: JSON.stringify(values) }) }
  update(id: string | number, values: Partial<Row<T>>) { return request<Row<T>>(`/rows/${this.table}/${id}`, { method: 'PATCH', body: JSON.stringify(values) }) }
  delete(id: string | number) { return request<{ ok: true }>(`/rows/${this.table}/${id}`, { method: 'DELETE' }) }
}

export interface Session { user: { id: string; email: string } | null }

export const db = {
  /** Owner-scoped read/write. What a signed-in user may see is enforced by the table's access mode. */
  from<T extends string>(table: T) { return new TableRef(table) },

  /**
   * The table's declared `publicView` — a PII-filtered projection readable by anyone, including a
   * signed-out visitor. Use it when a visitor must see which slots are taken WITHOUT seeing who
   * took them. Widening the table's access instead would expose the booker.
   */
  publicFrom<T extends string>(table: T) { return new Query(table, 'public') },

  auth: {
    async signUp(email: string, password: string): Promise<Result<Session>> {
      const r = await request<{ token: string; user: Session['user'] }>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) })
      if (r.data?.token) token.set(r.data.token)
      return { data: r.data ? { user: r.data.user } : null, error: r.error }
    },
    async signIn(email: string, password: string): Promise<Result<Session>> {
      const r = await request<{ token: string; user: Session['user'] }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      if (r.data?.token) token.set(r.data.token)
      return { data: r.data ? { user: r.data.user } : null, error: r.error }
    },
    signOut() { token.set(''); return Promise.resolve({ data: null, error: null } as Result<null>) },
    async getSession(): Promise<Result<Session>> {
      if (!token.get()) return { data: { user: null }, error: null }
      const r = await request<Session['user']>('/auth/me')
      return { data: { user: r.data ?? null }, error: r.error }
    },
    isSignedIn: () => Boolean(token.get()),
  },
}

export default db
