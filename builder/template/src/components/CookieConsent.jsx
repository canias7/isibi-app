import { useState } from 'react'
import Button from './Button.jsx'
import { cx } from '../lib/cx.js'

// CookieConsent — the consent bar. Remembers the choice in localStorage so it only shows once.
const KEY = 'isibi_cookie_consent'
export default function CookieConsent({ message = 'We use cookies to keep the site working and understand what people find useful.', policyHref, className }) {
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(KEY) } catch { return true }
  })
  const decide = (v) => { try { localStorage.setItem(KEY, v) } catch {} setOpen(false) }
  if (!open) return null
  return (
    <div className={cx('fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl rounded-xl2 border border-ink-100 bg-surface p-4 shadow-soft sm:flex sm:items-center sm:gap-4', className)}>
      <p className="flex-1 text-sm text-ink-600">
        {message}{' '}
        {policyHref && <a href={policyHref} className="font-medium text-brand-600 underline underline-offset-2">Privacy policy</a>}
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <Button size="sm" variant="secondary" onClick={() => decide('essential')}>Essential only</Button>
        <Button size="sm" onClick={() => decide('all')}>Accept all</Button>
      </div>
    </div>
  )
}
