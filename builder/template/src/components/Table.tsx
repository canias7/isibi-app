import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

type TableProps = React.ComponentPropsWithoutRef<'table'> & {
  className?: string
  children?: ReactNode
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-ink-100">
      <table className={cx('w-full text-sm border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

type THeadProps = React.ComponentPropsWithoutRef<'thead'> & {
  children?: ReactNode
  className?: string
}

export function THead({ children, className, ...props }: THeadProps) {
  return (
    <thead className={cx('bg-ink-50 text-ink-500 text-xs uppercase tracking-wide', className)} {...props}>
      {children}
    </thead>
  )
}

type TBodyProps = React.ComponentPropsWithoutRef<'tbody'> & {
  children?: ReactNode
  className?: string
}

export function TBody({ children, className, ...props }: TBodyProps) {
  return (
    <tbody className={cx('divide-y divide-ink-100', className)} {...props}>
      {children}
    </tbody>
  )
}

type TRProps = React.ComponentPropsWithoutRef<'tr'> & {
  children?: ReactNode
  className?: string
}

export function TR({ children, className, ...props }: TRProps) {
  return (
    <tr className={cx('hover:bg-ink-50/60 transition-colors', className)} {...props}>
      {children}
    </tr>
  )
}

type THProps = React.ComponentPropsWithoutRef<'th'> & {
  children?: ReactNode
  className?: string
}

export function TH({ children, className, ...props }: THProps) {
  return (
    <th className={cx('text-left font-semibold px-4 py-3 whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  )
}

type TDProps = React.ComponentPropsWithoutRef<'td'> & {
  children?: ReactNode
  className?: string
}

export function TD({ children, className, ...props }: TDProps) {
  return (
    <td className={cx('px-4 py-3 text-ink-800 align-middle', className)} {...props}>
      {children}
    </td>
  )
}

export default Table