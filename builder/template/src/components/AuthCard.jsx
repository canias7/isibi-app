import { cx } from '../lib/cx.js'

// AuthCard — the centred shell for sign-in / sign-up / reset screens.
export default function AuthCard({ title, subtitle, children, footer, className }) {
  return (
    <div className={cx('flex min-h-[70vh] items-center justify-center px-4 py-16', className)}>
      <div className="w-full max-w-sm">
        <div className="card-surface p-7">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-6 space-y-4">{children}</div>
        </div>
        {footer && <p className="mt-5 text-center text-sm text-ink-500">{footer}</p>}
      </div>
    </div>
  )
}
