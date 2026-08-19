import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The "/" menu inside an editor — insert a heading, a list, an image.
 *
 * Filters on the typed text AND on each item's keywords, so "bullet" finds
 * "Bulleted list" and "todo" finds "Checklist". A menu that matches only the
 * visible label is one people give up on after two misses.
 *
 * Selection is on mousedown with preventDefault: a click fires after blur, by
 * which time the editor has lost the caret the insertion needs.
 */
export type SlashItem = { key: string; label: string; hint?: string; keywords?: string[]; icon?: React.ReactNode };
export function SlashMenu({ items, query = "", activeIndex = 0, onPick, className }: {
  items: SlashItem[]; query?: string; activeIndex?: number;
  onPick: (item: SlashItem) => void; className?: string;
}) {
  const q = query.trim().toLowerCase();
  const shown = q
    ? items.filter((i) => i.label.toLowerCase().includes(q) || (i.keywords ?? []).some((k) => k.includes(q)))
    : items;
  if (!shown.length) {
    return (
      <div className={cn("rounded-md border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md", className)}>
        Nothing matches “{query}”.
      </div>
    );
  }
  return (
    <ul role="listbox" aria-label="Insert"
      className={cn("max-h-64 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md", className)}>
      {shown.map((it, i) => (
        // The option IS the clickable element — see the note in
        // `search-suggestions`. Focus stays in the editor, which is the whole
        // point of a slash menu.
        <li key={it.key} role="option" aria-selected={i === activeIndex}
          onMouseDown={(e) => { e.preventDefault(); onPick(it); }}
          className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-start",
            i === activeIndex ? "bg-muted" : "hover:bg-muted/60")}>
          {it.icon && <span className="shrink-0 text-muted-foreground">{it.icon}</span>}
          <span className="min-w-0 flex-1 truncate text-sm">{it.label}</span>
          {it.hint && <span className="shrink-0 text-xs text-muted-foreground">{it.hint}</span>}
        </li>
      ))}
    </ul>
  );
}
