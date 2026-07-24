import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import EmptyState from './EmptyState.jsx'
import Skeleton from './Skeleton.jsx'
import { cx } from '../lib/cx.js'

// DataTable — sortable table with built-in loading and empty states.
// columns: [{key, header, render?, align?, sortable?}]  rows: array of objects
export default function DataTable({ columns = [], rows = [], loading = false, empty, rowKey = (r, i) => r.id ?? i, onRowClick, className }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const sorted = useMemo(() => {
    if (!sort.key) return rows
    const c = [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key]
      if (x == null) return 1
      if (y == null) return -1
      return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    })
    return sort.dir === 'asc' ? c : c.reverse()
  }, [rows, sort])

  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  if (loading) return <div className={cx('space-y-2', className)}>{[0,1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
  if (!rows.length && empty) return <div className={className}>{empty}</div>
  if (!rows.length) return <EmptyState title="Nothing here yet" message="Records will show up once they're created." className={className} />

  return (
    <div className={cx('overflow-x-auto rounded-xl border border-ink-100 bg-surface', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/60">
            {columns.map((c) => (
              <th key={c.key} scope="col"
                className={cx('px-4 py-3 font-medium text-ink-500', c.align === 'right' ? 'text-right' : 'text-left')}>
                {c.sortable ? (
                  <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 transition hover:text-ink-800">
                    {c.header}
                    {sort.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {sorted.map((r, i) => (
            <tr key={rowKey(r, i)} onClick={() => onRowClick && onRowClick(r)}
              className={cx('transition', onRowClick && 'cursor-pointer hover:bg-ink-50')}>
              {columns.map((c) => (
                <td key={c.key} className={cx('px-4 py-3 text-ink-700', c.align === 'right' && 'text-right tabular-nums')}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
