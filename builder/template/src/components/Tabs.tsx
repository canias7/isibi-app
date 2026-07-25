import { useState } from 'react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface TabsProps {
  tabs?: any[]
  value?: any
  onChange?: (...args: any[]) => any
  className?: string
  children?: ReactNode
}

export default function Tabs({ tabs = [], value, onChange, className, children }: TabsProps) {
  const [internal, setInternal] = useState(tabs[0] && tabs[0].id)
  const active = value !== undefined ? value : internal
  const set = (id) => { if (value === undefined) setInternal(id); if (onChange) onChange(id) }
  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 border-b border-ink-100 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => set(t.id)}
            className={cx(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset',
              active === t.id
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-ink-500 hover:border-ink-200 hover:text-ink-800'
            )}
          >
            {t.label}
            {t.count != null && <span className="ml-2 rounded-full bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">{t.count}</span>}
          </button>
        ))}
      </div>
      {children && <div className="pt-4">{children}</div>}
    </div>
  )
}

interface TabPanelProps {
  when?: any
  active?: any
  children?: ReactNode
}

export function TabPanel({ when, active, children }: TabPanelProps) {
  if (when !== active) return null
  return <div role="tabpanel">{children}</div>
}
