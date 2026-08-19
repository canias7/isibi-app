import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
/**
 * Tabs that move into a "More" menu when they do not fit.
 *
 * THE ACTIVE TAB IS ALWAYS VISIBLE, even when it belongs in the overflow — it
 * swaps places with the last visible one. A tab strip that hides the tab you
 * are on is a strip that says nothing about where you are, which is its entire
 * job.
 *
 * The fit is measured with a `ResizeObserver` on the container, not on window
 * resize. A sidebar collapsing or a panel being dragged changes the width with
 * no window event at all, and the strip would stay wrong until something else
 * happened.
 *
 * The "More" button carries the COUNT, so the hidden tabs are visibly there
 * rather than being discovered by accident.
 *
 * Real `role="tablist"` semantics with one tab stop and arrow keys, including
 * across the overflow — the hidden ones are still tabs, not a separate menu.
 */
export function TabOverflow({ tabs, active, onSelect, className }: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const [fit, setFit] = React.useState(tabs.length);

  React.useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // The container can change width with no window resize at all.
    const ro = new ResizeObserver(() => {
      const room = el.clientWidth - 80;
      let used = 0, n = 0;
      for (const child of Array.from(el.querySelectorAll("[data-tab]")) as HTMLElement[]) {
        used += child.offsetWidth;
        if (used > room) break;
        n++;
      }
      setFit(Math.max(1, n));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);

  let visible = tabs.slice(0, fit);
  let hidden = tabs.slice(fit);
  // The tab you are on is never in the overflow.
  if (hidden.some((t) => t.key === active)) {
    const swap = visible[visible.length - 1];
    visible = [...visible.slice(0, -1), tabs.find((t) => t.key === active)!];
    hidden = [swap, ...hidden.filter((t) => t.key !== active)];
  }

  const move = (d: 1 | -1) => {
    const i = tabs.findIndex((t) => t.key === active);
    onSelect(tabs[(i + d + tabs.length) % tabs.length].key);
  };

  return (
    <div ref={wrap} role="tablist" aria-label="Sections"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
      }}
      className={cn("flex min-w-0 items-center gap-1 border-b border-border", className)}>
      {visible.map((t) => (
        <button key={t.key} data-tab role="tab" type="button"
          aria-selected={t.key === active}
          tabIndex={t.key === active ? 0 : -1}
          onClick={() => onSelect(t.key)}
          className={cn("cursor-pointer border-b-2 px-3 py-1.5 text-sm whitespace-nowrap",
            t.key === active ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {t.label}
        </button>
      ))}
      {hidden.length ? (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button"
              className="ms-auto inline-flex shrink-0 cursor-pointer items-center gap-1 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              {hidden.length} more
              <ChevronDown aria-hidden className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            <ul>
              {hidden.map((t) => (
                <li key={t.key}>
                  <button type="button" onClick={() => onSelect(t.key)}
                    className="w-full cursor-pointer truncate rounded px-2 py-1.5 text-start text-sm hover:bg-muted">
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
