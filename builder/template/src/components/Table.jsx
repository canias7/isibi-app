import { cx } from '../lib/cx.js'

export function Table({ className, children, ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-ink-100">
      <table className={cx('w-full text-sm border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function THead({ children, className, ...props }) {
  return (
    <thead className={cx('bg-ink-50 text-ink-500 text-xs uppercase tracking-wide', className)} {...props}>
      {children}
    </thead>
  )
}

export function TBody({ children, className, ...props }) {
  return (
    <tbody className={cx('divide-y divide-ink-100', className)} {...props}>
      {children}
    </tbody>
  )
}

export function TR({ children, className, ...props }) {
  return (
    <tr className={cx('hover:bg-ink-50/60 transition-colors', className)} {...props}>
      {children}
    </tr>
  )
}

export function TH({ children, className, ...props }) {
  return (
    <th className={cx('text-left font-semibold px-4 py-3 whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  )
}

export function TD({ children, className, ...props }) {
  return (
    <td className={cx('px-4 py-3 text-ink-800 align-middle', className)} {...props}>
      {children}
    </td>
  )
}

export default Table