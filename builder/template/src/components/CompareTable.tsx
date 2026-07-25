import { Check, Minus } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { Column } from '../lib/types.ts'

interface CompareTableProps {
  columns?: Column[]
  rows?: any[]
  className?: string
}

// CompareTable — feature comparison across plans/products.
// columns: [{key, label, featured}]  rows: [{label, values:{key: true|false|string}}]
export default function CompareTable({ columns = [], rows = [], className }: CompareTableProps) {
  const cell = (v) =>
    v === true ? <Check size={16} className="mx-auto text-brand-500" />
      : v === false || v == null ? <Minus size={14} className="mx-auto text-ink-300" />
      : <span className="text-sm text-ink-700">{v}</span>
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            <th scope="col" className="py-3 text-left text-sm font-medium text-ink-500" />
            {columns.map((c) => (
              <th key={c.key} scope="col"
                className={cx('px-4 py-3 text-center font-display text-sm font-semibold',
                  c.featured ? 'rounded-t-xl bg-brand-50 text-brand-700' : 'text-ink-900')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row" className="py-3 pr-4 text-left text-sm font-normal text-ink-600">{r.label}</th>
              {columns.map((c) => (
                <td key={c.key} className={cx('px-4 py-3 text-center', c.featured && 'bg-brand-50/50')}>
                  {cell(r.values ? r.values[c.key] : undefined)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
