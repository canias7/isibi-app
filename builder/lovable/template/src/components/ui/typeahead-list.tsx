import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The suggestions under a search box.
 *
 * PROPER COMBOBOX WIRING, which is what nearly every hand-rolled version gets
 * wrong: the list is a `listbox`, the highlighted row is referenced by
 * `aria-activedescendant`, and FOCUS STAYS IN THE INPUT. Moving focus into the
 * list breaks typing, which is the whole interaction.
 *
 * ARROW KEYS DO NOT WRAP here, deliberately — unlike a menu. Pressing up from
 * the first item should return to what you typed, and wrapping to the bottom
 * strands people who were trying to get back to their own text.
 *
 * The count is announced politely so a screen reader learns suggestions
 * appeared; without it the list is invisible to anybody not looking at it.
 */
export function TypeaheadList({ items, activeIndex, onActiveIndexChange, onPick, listId, className }: {
  items: { key: string; label: React.ReactNode; note?: string }[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onPick: (key: string) => void;
  /** Must match the input's aria-controls. */
  listId: string;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <>
      <p role="status" className="sr-only tabular-nums">{items.length} suggestions</p>
      <ul id={listId} role="listbox" className={cn("overflow-hidden rounded-md border border-border bg-background", className)}>
        {items.map((it, i) => (
          <li key={it.key} id={`${listId}-${i}`} role="option" aria-selected={i === activeIndex}
            onMouseEnter={() => onActiveIndexChange(i)}
            onMouseDown={(e) => { e.preventDefault(); onPick(it.key); }}
            className={cn("cursor-pointer px-3 py-2 text-sm", i === activeIndex && "bg-muted")}>
            <span className="block">{it.label}</span>
            {it.note && <span className="block text-xs text-muted-foreground">{it.note}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
