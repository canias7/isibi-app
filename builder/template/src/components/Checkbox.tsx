import { forwardRef, useId } from 'react'
import { Check, Minus } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

type CheckboxProps = React.ComponentPropsWithoutRef<'input'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  indeterminate?: boolean
  className?: string
}

const Checkbox = forwardRef(function Checkbox(
  { label, hint, error, indeterminate = false, className, ...props }: CheckboxProps,
  ref: any
) {
  const id = useId()
  return (
    <div className={cx('flex gap-3', className)}>
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="peer h-5 w-5 appearance-none rounded-md border border-ink-300 bg-surface transition
            checked:border-brand-500 checked:bg-brand-500
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:bg-ink-100"
          aria-describedby={hint || error ? `${id}-d` : undefined}
          {...props}
        />
        <span className="pointer-events-none absolute text-brandfg opacity-0 peer-checked:opacity-100">
          {indeterminate ? <Minus size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
        </span>
      </span>
      {(label || hint || error) && (
        <span className="min-w-0">
          {label && (
            <label htmlFor={id} className="block text-sm font-medium text-ink-800 cursor-pointer">
              {label}
            </label>
          )}
          {(hint || error) && (
            <span id={`${id}-d`} className={cx('mt-0.5 block text-xs', error ? 'text-rose-600' : 'text-ink-500')}>
              {error || hint}
            </span>
          )}
        </span>
      )}
    </div>
  )
})

export default Checkbox
