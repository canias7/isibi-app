import { cx } from '../lib/cx.js'

interface InvoiceTableProps {
  lines?: any[]
  totals?: any[]
  total?: any
  totalLabel?: string
  currency?: string
  className?: string
}

// InvoiceTable — line items with totals, for invoices/receipts/quotes.
// lines: [{description, qty, unitPrice, amount}]
export default function InvoiceTable({ lines = [], totals = [], total, totalLabel = 'Amount due', currency = '', className }: InvoiceTableProps) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left">
            <th scope="col" className="py-2.5 font-medium text-ink-500">Description</th>
            <th scope="col" className="py-2.5 text-right font-medium text-ink-500">Qty</th>
            <th scope="col" className="py-2.5 text-right font-medium text-ink-500">Unit</th>
            <th scope="col" className="py-2.5 text-right font-medium text-ink-500">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="py-3 text-ink-900">{l.description}</td>
              <td className="py-3 text-right tabular-nums text-ink-600">{l.qty}</td>
              <td className="py-3 text-right tabular-nums text-ink-600">{currency}{l.unitPrice}</td>
              <td className="py-3 text-right tabular-nums font-medium text-ink-900">{currency}{l.amount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {totals.map((t, i) => (
            <tr key={i}>
              <td colSpan={3} className="pt-3 text-right text-ink-500">{t.label}</td>
              <td className="pt-3 text-right tabular-nums text-ink-700">{currency}{t.value}</td>
            </tr>
          ))}
          {total != null && (
            <tr>
              <td colSpan={3} className="pt-3 text-right font-display font-semibold text-ink-900">{totalLabel}</td>
              <td className="pt-3 text-right font-display text-lg font-bold tabular-nums text-ink-900">{currency}{total}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  )
}
