import { cx } from '../lib/cx.js'

// StatusPill — a record's state with a leading dot (order/ticket/deal/booking status).
// Maps common status words to a tone automatically so pages don't hand-roll the mapping.
const AUTO = {
  active: 'success', live: 'success', paid: 'success', won: 'success', completed: 'success', approved: 'success', confirmed: 'success', open: 'success',
  pending: 'warning', draft: 'warning', review: 'warning', processing: 'warning', waitlist: 'warning', unpaid: 'warning',
  failed: 'danger', cancelled: 'danger', canceled: 'danger', lost: 'danger', overdue: 'danger', rejected: 'danger', closed: 'danger',
}
const tones = {
  neutral: 'bg-ink-100 text-ink-600 before:bg-ink-400',
  success: 'bg-emerald-50 text-emerald-700 before:bg-emerald-500',
  warning: 'bg-accent-50 text-accent-700 before:bg-accent-500',
  danger: 'bg-rose-50 text-rose-700 before:bg-rose-500',
  info: 'bg-sky-50 text-sky-700 before:bg-sky-500',
}

export default function StatusPill({ status, tone, className }) {
  const key = tone || AUTO[String(status).toLowerCase()] || 'neutral'
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
      'before:h-1.5 before:w-1.5 before:rounded-full before:content-[""]',
      tones[key], className
    )}>
      {status}
    </span>
  )
}
