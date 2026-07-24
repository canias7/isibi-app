import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  breadcrumb?: any
  className?: string
}

// PageHeader — the title / description / actions row every inner page starts with.
export default function PageHeader({ title, description, icon, actions, breadcrumb, className }: PageHeaderProps) {
  return (
    <div className={cx('mb-6', className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600">{icon}</span>}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
            {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
