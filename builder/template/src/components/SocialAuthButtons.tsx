import { cx } from '../lib/cx.js'

// Brand marks as inline SVG — no icon pack ships accurate provider logos, and a wrong-looking Google button
// measurably hurts sign-in conversion.
const MARKS = {
  google: (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21 7.6 23.5 12 23.5z" />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
      <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.6 15.1.5 12 .5 7.6.5 3.7 3 1.8 6.8l3.8 3c.9-2.8 3.4-4.7 6.4-4.7z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
      <path d="M17.6 12.7c0-2.6 2.1-3.9 2.2-4-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1 1-3.9 1-.8 0-2-1-3.3-1-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.2-1.2 3.1-2.5.7-1 1-2 1-2-.1 0-2.2-.8-2.2-3.7zM15.1 3.9c.7-.9 1.2-2.1 1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3.1-1.5z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z" />
    </svg>
  ),
}
const LABELS = { google: 'Google', github: 'GitHub', apple: 'Apple', facebook: 'Facebook' }

interface SocialAuthButtonsProps {
  providers?: any[]
  onSelect?: (...args: any[]) => any
  mode?: string
  divider?: string
  busy?: boolean
  className?: string
}

// SocialAuthButtons — the OAuth provider row on a sign-in screen, with the "or" divider.
// onSelect(provider) is called with the provider key; wire it to your auth redirect.
export default function SocialAuthButtons({
  providers = ['google', 'github'], onSelect, mode = 'Continue with', divider = 'or', busy, className,
}: SocialAuthButtonsProps) {
  return (
    <div className={className}>
      {/* Three or more providers go two-up, and then "Continue with Facebook" no longer fits on one line —
          so past two, drop the verb and show just the provider name. */}
      {(() => {
        const columns = providers.length > 2
        return (
          <div className={cx('grid gap-2', columns ? 'grid-cols-2' : 'grid-cols-1')}>
            {providers.map((p) => {
              const key = typeof p === 'string' ? p : p.id
              const label = typeof p === 'string' ? LABELS[p] || p : p.label
              return (
                <button key={key} type="button" onClick={() => onSelect && onSelect(key)} disabled={busy === key}
                  className={cx('flex items-center justify-center gap-2.5 rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm font-medium text-ink-800 transition',
                    'hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    busy === key && 'cursor-wait opacity-60')}
                  aria-label={`${mode} ${label}`}>
                  <span className="shrink-0">{MARKS[key]}</span>
                  <span className="truncate">{busy === key ? 'Redirecting…' : columns ? label : `${mode} ${label}`}</span>
                </button>
              )
            })}
          </div>
        )
      })()}
      {divider && (
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-ink-100" />
          <span className="text-xs uppercase tracking-wider text-ink-400">{divider}</span>
          <span className="h-px flex-1 bg-ink-100" />
        </div>
      )}
    </div>
  )
}
