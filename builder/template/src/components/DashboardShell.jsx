import { cx } from '../lib/cx.js'

// DashboardShell — the standard admin page frame: header row, optional toolbar, then the grid.
export default function DashboardShell({ title, description, actions, toolbar, children, className }) {
  return (
    <div className={cx('container-page py-8', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {toolbar && <div className="mt-5 flex flex-wrap items-center gap-3">{toolbar}</div>}
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  )
}
