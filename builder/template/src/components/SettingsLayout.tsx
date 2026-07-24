import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface SettingsLayoutProps {
  tabs?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  title?: string
  children?: ReactNode
  className?: string
}

// SettingsLayout — the settings/account pattern: a section nav beside the active panel.
// tabs: [{id, label, icon}]
export default function SettingsLayout({ tabs = [], value, onChange, title = 'Settings', children, className }: SettingsLayoutProps) {
  return (
    <div className={cx('grid gap-8 md:grid-cols-[220px_1fr]', className)}>
      <nav className="space-y-0.5">
        <h2 className="mb-3 px-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-400">{title}</h2>
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => onChange && onChange(t.id)}
            className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition',
              value === t.id ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900')}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 divide-y divide-ink-100">{children}</div>
    </div>
  )
}
