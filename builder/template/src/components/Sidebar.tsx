import { NavLink } from 'react-router-dom'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

interface SidebarProps {
  items?: any[]
  header?: ReactNode
  footer?: ReactNode
  className?: string
}

// Sidebar — the dashboard shell's left rail. items: [{to, label, icon, badge}] or {section:'Label'}.
export function Sidebar({ items = [], header, footer, className }: SidebarProps) {
  return (
    <aside className={cx('flex w-60 shrink-0 flex-col border-r border-ink-100 bg-surface', className)}>
      {header && <div className="border-b border-ink-100 px-4 py-4">{header}</div>}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((it, i) =>
          it.section ? (
            <p key={i} className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-ink-400">{it.section}</p>
          ) : (
            <NavLink key={it.to} to={it.to}
              className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
              )}>
              {it.icon}
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.badge != null && <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">{it.badge}</span>}
            </NavLink>
          )
        )}
      </nav>
      {footer && <div className="border-t border-ink-100 p-3">{footer}</div>}
    </aside>
  )
}

interface SidebarLayoutProps {
  items?: any[]
  header?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
}

// SidebarLayout — sidebar + scrolling content, for admin/dashboard pages.
// Exported BOTH as the default and by name, so either import style works.
export function SidebarLayout({ items, header, footer, children, className }: SidebarLayoutProps) {
  return (
    <div className={cx('flex min-h-[70vh]', className)}>
      <Sidebar items={items} header={header} footer={footer} className="hidden md:flex" />
      <div className="min-w-0 flex-1 p-6">{children}</div>
    </div>
  )
}

export default SidebarLayout
