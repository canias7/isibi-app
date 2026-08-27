import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A list you move through with arrow keys, not Tab.
 *
 * THE WHOLE LIST IS ONE TAB STOP. A sidebar of forty links means forty presses
 * of Tab to reach the content past it, which is the single most common reason
 * keyboard users abandon an interface. Roving tabindex fixes it: one item is
 * `tabIndex=0`, the rest are `-1`, and arrows move the zero.
 *
 * FOCUS IS MOVED IMPERATIVELY, not just re-rendered. Setting tabIndex alone
 * changes what Tab would reach next and leaves the browser's focus exactly
 * where it was, so the arrow key appears to do nothing — the bug every
 * hand-rolled version of this has.
 *
 * Home and End jump to the ends, and the list WRAPS. Both are what the ARIA
 * practices describe and what people already expect from every native menu.
 *
 * `onActivate` fires on Enter and Space, because a row that highlights and
 * cannot be chosen is half a control.
 */
export function RovingList({ items, activeIndex, onActiveIndexChange, onActivate, label, className }: {
  items: { key: string; label: React.ReactNode }[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onActivate?: (key: string) => void;
  label: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLLIElement | null)[]>([]);
  if (!items.length) return null;
  const last = items.length - 1;
  const active = Math.min(Math.max(activeIndex, 0), last);

  const move = (i: number) => {
    onActiveIndexChange(i);
    refs.current[i]?.focus();
  };

  return (
    <ul data-slot="roving-list" role="listbox" aria-label={label}
      className={cn("divide-y divide-border rounded-md border border-border", className)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); move(active === last ? 0 : active + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(active === 0 ? last : active - 1); }
        else if (e.key === "Home") { e.preventDefault(); move(0); }
        else if (e.key === "End") { e.preventDefault(); move(last); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate?.(items[active].key); }
      }}>
      {items.map((it, i) => (
        <li key={it.key}
          ref={(el) => { refs.current[i] = el; }}
          role="option" aria-selected={i === active}
          tabIndex={i === active ? 0 : -1}
          onClick={() => { onActiveIndexChange(i); onActivate?.(it.key); }}
          onFocus={() => onActiveIndexChange(i)}
          className={cn("cursor-pointer px-3 py-2 text-sm outline-none",
            i === active ? "bg-muted font-medium" : "hover:bg-muted/50")}>
          {it.label}
        </li>
      ))}
    </ul>
  );
}
