import Input from './Input.jsx'
import Select from './Select.jsx'
import { cx } from '../lib/cx.js'

// TravelerForm — passenger/guest details for a booking. Names must match the travel document, so the
// component says so rather than leaving it to a page to remember; that mismatch is the #1 cause of a
// rejected booking.
export default function TravelerForm({
  index, type = 'Adult', value = {}, onChange, requirePassport = false, requireDob = true, className,
}) {
  const set = (k, v) => onChange && onChange({ ...value, [k]: v })
  return (
    <fieldset className={cx('card-surface p-5', className)}>
      <legend className="sr-only">Traveller {index}</legend>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink-900">
          Traveller {index}
        </h3>
        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-600">{type}</span>
      </div>
      <p className="mt-1 text-xs text-ink-400">Enter names exactly as they appear on the travel document.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select label="Title" value={value.title || ''} onChange={(e) => set('title', e.target.value)}>
          <option value="">Choose…</option>
          {['Mr', 'Ms', 'Mrs', 'Mx', 'Dr'].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <div className="hidden sm:block" />
        <Input label="First name(s)" value={value.firstName || ''} onChange={(e) => set('firstName', e.target.value)} autoComplete="given-name" required />
        <Input label="Last name" value={value.lastName || ''} onChange={(e) => set('lastName', e.target.value)} autoComplete="family-name" required />
        {requireDob && (
          <Input label="Date of birth" type="date" value={value.dob || ''} onChange={(e) => set('dob', e.target.value)} autoComplete="bday" required />
        )}
        <Select label="Nationality" value={value.nationality || ''} onChange={(e) => set('nationality', e.target.value)}>
          <option value="">Choose…</option>
          {['United Kingdom', 'United States', 'Ireland', 'Australia', 'Canada', 'France', 'Germany', 'Spain', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {requirePassport && (
          <>
            <Input label="Passport number" value={value.passport || ''} onChange={(e) => set('passport', e.target.value)} />
            <Input label="Passport expiry" type="date" value={value.passportExpiry || ''} onChange={(e) => set('passportExpiry', e.target.value)}
              hint="Must be valid for the whole trip." />
          </>
        )}
      </div>
    </fieldset>
  )
}
