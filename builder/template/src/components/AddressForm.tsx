import Input from './Input.tsx'
import Select from './Select.tsx'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface AddressFormProps {
  prefix?: string
  title?: ReactNode
  countries?: any[]
  className?: string
}

// AddressForm — the shipping/billing block for checkout. Field names match common backend columns.
export default function AddressForm({ prefix = '', title, countries = ['United States', 'United Kingdom', 'Canada', 'Australia'], className }: AddressFormProps) {
  const n = (f) => (prefix ? `${prefix}_${f}` : f)
  return (
    <div className={cx('space-y-4', className)}>
      {title && <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name={n('first_name')} label="First name" autoComplete="given-name" required />
        <Input name={n('last_name')} label="Last name" autoComplete="family-name" required />
      </div>
      <Input name={n('line1')} label="Address" autoComplete="address-line1" required />
      <Input name={n('line2')} label="Apartment, suite (optional)" autoComplete="address-line2" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Input name={n('city')} label="City" autoComplete="address-level2" required />
        <Input name={n('region')} label="State / Region" autoComplete="address-level1" />
        <Input name={n('postal_code')} label="Postcode" autoComplete="postal-code" required />
      </div>
      <Select name={n('country')} label="Country" autoComplete="country-name" required>
        {countries.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
    </div>
  )
}
