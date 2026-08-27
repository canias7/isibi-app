import * as React from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The sidebar that shrinks to icons, and the button that does it.
 *
 * COLLAPSED, EVERY ITEM KEEPS ITS LABEL as `sr-only` and gets a `title`. An
 * icon rail where the accessible name went with the visible text is a
 * navigation menu that reads as a column of unnamed buttons — and even for
 * sighted users, a `title` is the difference between a guessable icon and a
 * mystery.
 *
 * The state is PERSISTED. Somebody who collapses the sidebar to get more room
 * for a table means it, and re-expanding on every navigation is the same
 * annoyance as a forgotten split.
 *
 * The toggle keeps `aria-expanded` and points at the region it controls, so the
 * state is announced rather than being purely visual.
 *
 * Collapsing hides TEXT, not items. Dropping entries from the rail means the
 * only way to reach them is to expand again, and nothing on screen says they
 * exist.
 */
export function useSidebarCollapsed(name = "sidebar") {
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    try { setCollapsed(localStorage.getItem(`collapsed:${name}`) === "1"); } catch { /* private mode */ }
  }, [name]);
  const toggle = React.useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(`collapsed:${name}`, next ? "1" : "0"); } catch { /* as above */ }
      return next;
    });
  }, [name]);
  return { collapsed, toggle };
}

export function SidebarCollapseButton({ collapsed, onToggle, controls, className }: {
  collapsed: boolean;
  onToggle: () => void;
  controls?: string;
  className?: string;
}) {
  return (
    <button data-slot="sidebar-collapse-button" type="button" onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls={controls}
      aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
      className={cn("cursor-pointer rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
      {collapsed ? <PanelLeft aria-hidden className="size-4" /> : <PanelLeftClose aria-hidden className="size-4" />}
    </button>
  );
}

export function SidebarItem({ icon, label, href, active, collapsed, badge, onClick, className }: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  collapsed?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const shared = cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
    active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    collapsed && "justify-center px-0", className);
  const body = (
    <>
      <span className="shrink-0">{icon}</span>
      {/* The label never leaves the DOM — a collapsed rail must not become a
          column of unnamed buttons. */}
      <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{label}</span>
      {badge && !collapsed ? <span className="shrink-0">{badge}</span> : null}
    </>
  );
  return href ? (
    <a href={href} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} className={shared}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined} className={cn(shared, "w-full cursor-pointer text-start")}>
      {body}
    </button>
  );
}
