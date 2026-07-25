import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Search } from 'lucide-react'
import { cx } from '../lib/cx.js'

// highlight(text, q) — wraps matches in <mark>. Exported because search results everywhere want this and
// hand-rolling it with dangerouslySetInnerHTML is how XSS gets in.
export function highlight(text, q) {
  const needle = String(q || '').trim()
  if (!needle) return text
  const parts = String(text).split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
  return parts.map((p, i) => (p.toLowerCase() === needle.toLowerCase()
    ? <mark key={i} className="rounded bg-accent-100 px-0.5 text-ink-900">{p}</mark>
    : p))
}

interface KnowledgeBaseSearchProps {
  articles?: any[]
  popular?: any[]
  title?: string
  placeholder?: string
  onSearch?: (...args: any[]) => any
  emptyText?: string
  className?: string
}

// KnowledgeBaseSearch — the help-centre search box with live results and popular topics underneath.
// articles: [{id, title, excerpt, category, to}]
export default function KnowledgeBaseSearch({
  articles = [], popular = [], title = 'How can we help?', placeholder = 'Search help articles…',
  onSearch, emptyText = 'No articles match that. Try a different word, or contact us.', className,
}: KnowledgeBaseSearchProps) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const results = useMemo(() => (!needle ? []
    : articles.filter((a) => `${a.title} ${a.excerpt || ''} ${a.category || ''}`.toLowerCase().includes(needle)).slice(0, 8)),
    [articles, needle])
  return (
    <div className={className}>
      {title && <h2 className="text-center font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h2>}
      <form className="relative mx-auto mt-5 max-w-xl" onSubmit={(e) => { e.preventDefault(); onSearch && onSearch(q) }}>
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ((e.target as any).value)} placeholder={placeholder} aria-label={String(placeholder ?? "")}
          className="w-full rounded-xl2 border border-ink-200 bg-surface py-3.5 pl-12 pr-4 text-sm text-ink-900 shadow-soft placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
      </form>
      {needle && (
        <div className="mx-auto mt-4 max-w-xl">
          {results.length === 0
            ? <p className="rounded-xl2 border border-ink-100 bg-surface px-5 py-8 text-center text-sm text-ink-500">{emptyText}</p>
            : (
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl2 border border-ink-100 bg-surface">
                {results.map((a) => (
                  <li key={a.id}>
                    <Link to={a.to} className="flex gap-3 px-5 py-3.5 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
                      <FileText size={16} className="mt-0.5 shrink-0 text-ink-400" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink-900">{highlight(a.title, q)}</span>
                        {a.excerpt && <span className="mt-0.5 block line-clamp-1 text-xs text-ink-500">{highlight(a.excerpt, q)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
      {!needle && popular.length > 0 && (
        <div className="mx-auto mt-6 max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Popular</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {popular.map((p, i) => (
              <Link key={i} to={p.to}
                className="rounded-full border border-ink-200 px-3 py-1 text-sm text-ink-600 transition hover:border-ink-400 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
