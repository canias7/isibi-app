import { forwardRef, useId } from 'react'
import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

type InputProps = React.ComponentPropsWithoutRef<'input'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  wrapperClassName?: any
  id?: string
}

const Input = forwardRef(function Input(
  { label, hint, error, className, wrapperClassName, id, ...props }: InputProps,
  ref: any
) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <div className={cx('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cx(
          'w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
          error ? 'border-rose-400' : 'border-ink-200 hover:border-ink-300',
          className
        )}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-rose-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-xs text-ink-500">
          {hint}
        </p>
      )}
    </div>
  )
})

export default Input