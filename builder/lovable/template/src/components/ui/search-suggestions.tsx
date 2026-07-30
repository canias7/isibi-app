import * as React from "react";
import { HighlightMatch } from "@/components/ui/highlight-match";
import { cn } from "@/lib/utils";
/**
 * The dropdown under a search box.
 *
 * Arrow keys move a highlighted index that the parent owns, so the same state
 * drives both this list and `aria-activedescendant` on the input. A list that
 * tracks its own highlight cannot be steered from the keyboard at all.
 */
export function SearchSuggestions({ items, query, activeIndex = -1, onSelect, className }: {
  items: { label: string; hint?: string }[]; query?: string;
  activeIndex?: number; onSelect: (label: string, index: number) => void; className?: string;
}) {
  if (!items.length) return null;
  return (
    <ul role="listbox" className={cn("overflow-hidden rounded-md border border-border bg-popover py-1 shadow-md", className)}>
      {items.map((it, i) => (
        <li key={it.label} id={`suggestion-${i}`} role="option" aria-selected={i === activeIndex}>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); onSelect(it.label, i); }}
            className={cn("flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-sm",
              i === activeIndex ? "bg-muted" : "hover:bg-muted/60")}>
            <span className="truncate"><HighlightMatch text={it.label} query={query ?? ""} /></span>
            {it.hint && <span className="shrink-0 text-xs text-muted-foreground">{it.hint}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
