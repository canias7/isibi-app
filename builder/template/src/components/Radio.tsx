import { useId } from 'react'
import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

type RadioProps = React.ComponentPropsWithoutRef<'input'> & {
  label?: ReactNode
  hint?: ReactNode
  name?: string
  className?: string
}

export function Radio({ label, hint, name, className, ...props }: RadioProps) {
  const id = useId()
  return (
    <div className={cx('flex gap-3', className)}>
      <input
        id={id}
        name={name}
        type="radio"
        className="mt-0.5 h-5 w-5 shrink-0 appearance-none rounded-full border border-ink-300 bg-surface transition
          checked:border-[6px] checked:border-brand-500
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:bg-ink-100"
        {...props}
      />
      {(label || hint) && (
        <span className="min-w-0">
          {label && <label htmlFor={id} className="block text-sm font-medium text-ink-800 cursor-pointer">{label}</label>}
          {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
        </span>
      )}
    </div>
  )
}

type RadioGroupProps = React.ComponentPropsWithoutRef<'fieldset'> & {
  label?: ReactNode
  error?: ReactNode
  children?: ReactNode
  className?: string
}

export default function RadioGroup({ label, error, children, className, ...props }: RadioGroupProps) {
  return (
    <fieldset className={cx('space-y-3', className)} {...props}>
      {label && <legend className="mb-1 text-sm font-medium text-ink-800">{label}</legend>}
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </fieldset>
  )
}
