import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A row of small labels that WRAPS and can overflow into "+4 more".
 *
 * Different from `tag-list`, which shows everything: this one is for a fixed
 * row height inside a table cell or a card, where five tags on one record
 * must not push every other row out of line.
 *
 * The hidden ones stay in the accessible name and the title, so nothing is
 * actually lost — only visually deferred.
 */
export function ChipList({ items, max, onRemove, onClick, className }: {
  items: { value: string; label: string }[]; max?: number;
  onRemove?: (value: string) => void; onClick?: (value: string) => void; className?: string;
}) {
  if (!items.length) return null;
  const shown = max != null ? items.slice(0, max) : items;
  const rest = items.length - shown.length;
  return (
    <ul className={cn("flex flex-wrap items-center gap-1", className)}
      aria-label={items.map((i) => i.label).join(", ")}>
      {shown.map((it) => (
        <li key={it.value}>
          {/* THE CHIP'S `onClick` WAS ON A BARE `<span>` — no role, no
              tabIndex, no key handler — so it could be clicked and never
              reached by keyboard. The label becomes a real `<button>` instead
              of making the whole chip one, because the remove control below is
              already a button and a button inside a button is invalid markup
              that browsers silently restructure. */}
          <span className={cn("inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs",
            onClick && "hover:bg-muted")}>
            {onClick
              ? <button type="button" onClick={() => onClick(it.value)}
                  className="cursor-pointer">{it.label}</button>
              : it.label}
            {onRemove && (
              <button type="button" aria-label={`Remove ${it.label}`}
                onClick={(e) => { e.stopPropagation(); onRemove(it.value); }}
                className="cursor-pointer text-muted-foreground hover:text-foreground">×</button>
            )}
          </span>
        </li>
      ))}
      {rest > 0 && (
        <li className="text-xs text-muted-foreground" title={items.slice(shown.length).map((i) => i.label).join(", ")}>
          +{rest} more
        </li>
      )}
    </ul>
  );
}
