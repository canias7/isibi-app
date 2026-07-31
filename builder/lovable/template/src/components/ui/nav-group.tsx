import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A collapsible section of a sidebar.
 *
 * IT OPENS WHEN SOMETHING INSIDE IT IS ACTIVE, whatever the saved state. A
 * sidebar that hides the section containing the current page leaves nothing on
 * screen saying where you are — and it happens on every page load after
 * somebody collapses that group once.
 *
 * The heading is a `<button>` with `aria-expanded`, not a div. A collapsible
 * group whose toggle is unreachable makes its whole contents unreachable.
 *
 * The COUNT shows when collapsed, so a folded group still says how much is in
 * it — the same reason `row-group` keeps its count.
 *
 * State is per group and persisted by name, because a sidebar's shape is
 * something people arrange once and expect to keep.
 */
export function NavGroup({ title, count, children, containsActive, name, defaultOpen = true, className }: {
  title: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  containsActive?: boolean;
  name?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  React.useEffect(() => {
    if (!name) return;
    try {
      const saved = localStorage.getItem(`navgroup:${name}`);
      if (saved != null) setOpen(saved === "1");
    } catch { /* private mode */ }
  }, [name]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try { if (name) localStorage.setItem(`navgroup:${name}`, next ? "1" : "0"); } catch { /* as above */ }
      return next;
    });
  };

  // Never hide the section holding the current page.
  const shown = open || containsActive;

  return (
    <div className={cn("flex flex-col", className)}>
      <button type="button" onClick={toggle} aria-expanded={shown}
        className="flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground">
        <ChevronRight aria-hidden className={cn("size-3 shrink-0 transition-transform", shown && "rotate-90")} />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {!shown && count ? <span className="tabular-nums">{count}</span> : null}
      </button>
      {shown ? <div className="flex flex-col gap-0.5 pl-2">{children}</div> : null}
    </div>
  );
}
