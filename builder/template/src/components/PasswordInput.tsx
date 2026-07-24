import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type React from 'react'
import type { ReactNode } from 'react'

// strength(pw) → 0..4. Length dominates (it should), with a bonus per character class.
export function passwordStrength(pw = '') {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s)
}

type PasswordInputProps = React.ComponentPropsWithoutRef<'input'> & {
  label?: string
  hint?: ReactNode
  error?: ReactNode
  showStrength?: boolean
  value?: any
  className?: string
  wrapperClassName?: any
  id?: string
}

// PasswordInput — password field with show/hide and an optional strength meter (sign-up screens).
const PasswordInput = forwardRef(function PasswordInput(
  { label = 'Password', hint, error, showStrength = false, value, className, wrapperClassName, id, ...props }: PasswordInputProps, ref: any,
) {
  const autoId = useId()
  const fieldId = id || autoId
  const [shown, setShown] = useState(false)
  const score = passwordStrength(value || '')
  const words = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
  const tones = ['bg-ink-200', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']
  return (
    <div className={cx('flex flex-col gap-1.5', wrapperClassName)}>
      {label && <label htmlFor={fieldId} className="text-sm font-medium text-ink-700">{label}</label>}
      <div className="relative">
        <input ref={ref} id={fieldId} type={shown ? 'text' : 'password'} value={value} aria-invalid={!!error}
          className={cx('w-full rounded-xl border bg-surface px-3.5 py-2.5 pr-11 text-sm text-ink-900 placeholder:text-ink-400 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500',
            error ? 'border-rose-400' : 'border-ink-200 hover:border-ink-300', className)}
          {...props} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-ink-400 transition hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showStrength && (
        <div aria-live="polite">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cx('h-1 flex-1 rounded-full transition-colors', i <= score ? tones[score] : 'bg-ink-100')} />
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-500">{value ? words[score] : 'Use 12+ characters with a mix of cases, a number and a symbol.'}</p>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  )
})
export default PasswordInput
