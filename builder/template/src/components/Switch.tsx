import { useId } from 'react'
import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

type SwitchProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'onChange'> & {
  checked?: boolean
  onChange?: (...args: any[]) => any
  label?: ReactNode
  hint?: ReactNode
  disabled?: boolean
  className?: string
}

export default function Switch({ checked = false, onChange, label, hint, disabled, className, ...props }: SwitchProps) {
  const id = useId()
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange && onChange(!checked)}
        className={cx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          checked ? 'bg-brand-500' : 'bg-ink-200',
          disabled && 'cursor-not-allowed opacity-60'
        )}
        {...props}
      >
        <span
          className={cx(
            'inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <label htmlFor={id} className="block text-sm font-medium text-ink-800 cursor-pointer">{label}</label>}
          {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
        </span>
      )}
    </div>
  )
}
