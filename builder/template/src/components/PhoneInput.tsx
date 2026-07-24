import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

// A short, common dial-code list. Pass `countries` to override for a region-specific app.
export const DIAL_CODES = [
  { code: '+1', label: 'US/CA' }, { code: '+44', label: 'UK' }, { code: '+61', label: 'AU' },
  { code: '+64', label: 'NZ' }, { code: '+353', label: 'IE' }, { code: '+33', label: 'FR' },
  { code: '+49', label: 'DE' }, { code: '+34', label: 'ES' }, { code: '+39', label: 'IT' },
  { code: '+31', label: 'NL' }, { code: '+27', label: 'ZA' }, { code: '+91', label: 'IN' },
  { code: '+81', label: 'JP' }, { code: '+55', label: 'BR' }, { code: '+52', label: 'MX' },
]

interface PhoneInputProps {
  label?: string
  value?: Record<string, any>
  onChange?: (...args: any[]) => any
  countries?: any[]
  hint?: ReactNode
  error?: ReactNode
  className?: string
  wrapperClassName?: any
  id?: string
}

// PhoneInput — dial code + number as one control. value = {dial, number}; onChange gets the whole object,
// so a form can store it in a single field.
export default function PhoneInput({
  label = 'Phone', value = {}, onChange, countries = DIAL_CODES, hint, error, className, wrapperClassName, id,
}: PhoneInputProps) {
  const autoId = useId()
  const fieldId = id || autoId
  const set = (patch) => onChange && onChange({ dial: value.dial || countries[0].code, number: value.number || '', ...patch })
  return (
    <div className={cx('flex flex-col gap-1.5', wrapperClassName)}>
      {label && <label htmlFor={fieldId} className="text-sm font-medium text-ink-700">{label}</label>}
      <div className={cx('flex rounded-xl border bg-surface transition-colors focus-within:ring-2 focus-within:ring-brand-500/40',
        error ? 'border-rose-400' : 'border-ink-200 focus-within:border-brand-500 hover:border-ink-300', className)}>
        <div className="relative shrink-0">
          <select value={value.dial || countries[0].code} onChange={(e) => set({ dial: (e.target as any).value })} aria-label="Country dialling code"
            className="h-full appearance-none rounded-l-xl bg-transparent py-2.5 pl-3.5 pr-7 text-sm text-ink-700 focus:outline-none">
            {countries.map((c) => <option key={c.code} value={c.code}>{c.label} {c.code}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" />
        </div>
        <span className="my-2 w-px bg-ink-100" aria-hidden="true" />
        <input id={fieldId} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="555 018 2244"
          value={value.number || ''} onChange={(e) => set({ number: (e.target as any).value })}
          className="w-full rounded-r-xl bg-transparent px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none" />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  )
}
