import { useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cx } from '../lib/cx.js'
import type { ReactNode } from 'react'

export interface SidebarItem {
  to?: string
  label?: string
  icon?: ReactNode
  badge?: ReactNode
  /** A group heading with no link of its own. */
  section?: string
  /** Nested links. An item with `children` renders as a collapsible group instead of a link. */
  children?: SidebarItem[]
  /** Start the group open. Groups containing the current route open themselves regardless. */
  defaultOpen?: boolean
}

interface SidebarProps {
  items?: SidebarItem[]
  header?: ReactNode
  footer?: ReactNode
  /** Show the collapse control and allow the rail to shrink to icons. */
  collapsible?: boolean
  /** Start collapsed. Only meaningful with `collapsible`. */
  defaultCollapsed?: boolean
  className?: string
}

const linkClass = (isActive: boolean, depth = 0) =>
  cx(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
    depth > 0 && 'ml-3 border-l border-ink-100 pl-4',
    isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
  )

// One link row. When the rail is collapsed the label and badge are hidden but kept in the DOM as a title, so
// the icon still says what it is on hover and to a screen reader.
function SidebarLink({ item, collapsed, depth }: { item: SidebarItem; collapsed: boolean; depth: number }) {
  return (
    <NavLink
      to={item.to || '#'}
      // Collapsed, the only content is an icon, so the link needs a name of its own — `title` alone is a
      // hover affordance a keyboard or screen-reader user never gets.
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => cx(linkClass(isActive, collapsed ? 0 : depth), collapsed && 'justify-center px-2')}
    >
      {item.icon}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge != null && (
        <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">{item.badge}</span>
      )}
    </NavLink>
  )
}

// A collapsible group of links. Hand-rolled rather than pulled from a primitives package because the whole
// accessible surface of a disclosure is aria-expanded + aria-controls on a real <button>, which is right here.
function SidebarGroup({ item, collapsed, depth }: { item: SidebarItem; collapsed: boolean; depth: number }) {
  const { pathname } = useLocation()
  const panelId = useId()
  const kids = item.children || []
  // A group holding the current route must be open, else the user cannot see where they are.
  const holdsCurrent = kids.some((k) => k.to && pathname.startsWith(k.to))
  const [open, setOpen] = useState(Boolean(item.defaultOpen) || holdsCurrent)
  const shown = open || holdsCurrent

  // Collapsed to a rail there is nowhere to put the children, so the group degrades to its icon.
  if (collapsed) {
    return (
      <div title={item.label} aria-label={item.label} className={cx(linkClass(holdsCurrent), 'justify-center px-2')}>
        {item.icon}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={panelId}
        onClick={() => setOpen(!shown)}
        className={cx(linkClass(false, depth), 'w-full text-left')}
      >
        {item.icon}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronRight size={14} className={cx('shrink-0 transition-transform', shown && 'rotate-90')} />
      </button>
      <div id={panelId} hidden={!shown} className="mt-0.5 space-y-0.5">
        {kids.map((k, i) => <SidebarLink key={k.to || i} item={k} collapsed={false} depth={depth + 1} />)}
      </div>
    </div>
  )
}

// Sidebar — the dashboard shell's left rail.
// items: [{to, label, icon, badge}] · [{section:'Label'}] · [{label, icon, children:[{to,label}]}] for a
// collapsible group. Pass `collapsible` to get the icon-rail toggle.
export function Sidebar({ items = [], header, footer, collapsible = false, defaultCollapsed = false, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)
  const isRail = collapsible && collapsed

  return (
    <aside
      data-collapsed={isRail ? 'true' : 'false'}
      className={cx('flex shrink-0 flex-col border-r border-ink-100 bg-surface transition-[width] duration-200',
        isRail ? 'w-16' : 'w-60', className)}
    >
      {header && <div className={cx('border-b border-ink-100 py-4', isRail ? 'px-2' : 'px-4')}>{header}</div>}

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((it, i) =>
          it.section ? (
            isRail
              ? <hr key={i} className="my-3 border-ink-100" />
              : <p key={i} className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-ink-400">{it.section}</p>
          ) : it.children && it.children.length ? (
            <SidebarGroup key={it.label || i} item={it} collapsed={isRail} depth={0} />
          ) : (
            <SidebarLink key={it.to || i} item={it} collapsed={isRail} depth={0} />
          )
        )}
      </nav>

      {footer && !isRail && <div className="border-t border-ink-100 p-3">{footer}</div>}

      {collapsible && (
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center gap-3 border-t border-ink-100 px-4 py-3 text-sm text-ink-500 transition hover:bg-ink-50 hover:text-ink-800"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      )}
    </aside>
  )
}

interface SidebarLayoutProps extends SidebarProps {
  children?: ReactNode
}

// SidebarLayout — sidebar + scrolling content, for admin/dashboard pages.
// Exported BOTH as the default and by name, so either import style works.
export function SidebarLayout({ items, header, footer, collapsible, defaultCollapsed, children, className }: SidebarLayoutProps) {
  return (
    <div className={cx('flex min-h-[70vh]', className)}>
      <Sidebar items={items} header={header} footer={footer} collapsible={collapsible}
        defaultCollapsed={defaultCollapsed} className="hidden md:flex" />
      <div className="min-w-0 flex-1 p-6">{children}</div>
    </div>
  )
}

export default SidebarLayout
