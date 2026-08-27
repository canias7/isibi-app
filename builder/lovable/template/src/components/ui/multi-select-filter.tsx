import { useState } from "react";
import { cn } from "@/lib/utils";
/**
 * Picking several values from a long list, searchable, with a cap on what is
 * shown.
 *
 * SELECTED VALUES ARE PINNED TO THE TOP, always. In a list of 200 suppliers,
 * scrolling to check what you have chosen is the single most annoying thing
 * about this control — and after typing a search, the chosen ones vanish
 * entirely, which reads as the selection being lost.
 *
 * SHOW-MORE RATHER THAN A SCROLLBOX. A nested scroll area inside a filter panel
 * inside a page traps the wheel and is nearly unusable on a trackpad; a capped
 * list with a count is honest about how much is hidden.
 *
 * THE SEARCH APPEARS ONLY WHEN THE LIST IS LONG ENOUGH TO NEED IT. A search box
 * above five options is a control that costs more attention than it saves.
 *
 * ZERO-COUNT OPTIONS ARE SHOWN, NOT HIDDEN, because a value disappearing from a
 * filter panel reads as data loss — but they are marked, so nobody picks one
 * and gets an empty list.
 */
export function MultiSelectFilter({ options, selected, onChange, searchAfter = 8, showAtFirst = 8, label, className }: {
  options: { id: string; label: string; count?: number }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Show a search box once there are more options than this. */
  searchAfter?: number;
  showAtFirst?: number;
  label?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const query = q.trim().toLowerCase();
  const matched = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;
  const chosen = matched.filter((o) => selected.includes(o.id));
  const rest = matched.filter((o) => !selected.includes(o.id));
  const ordered = [...chosen, ...rest];
  const shown = all ? ordered : ordered.slice(0, Math.max(showAtFirst, chosen.length));
  const hidden = ordered.length - shown.length;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div data-slot="multi-select-filter" className={cn("space-y-1.5", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      {options.length > searchAfter && (
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search"
          aria-label={label ? `Search ${label}` : "Search options"} placeholder="Search"
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      )}
      <ul>
        {shown.map((o) => (
          <li key={o.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)}
                className="size-4 shrink-0 accent-foreground" />
              <span className="min-w-0 truncate">{o.label}</span>
              {o.count !== undefined && (
                <span className={cn("ms-auto shrink-0 text-xs tabular-nums text-muted-foreground",
                  o.count === 0 && "italic")}>
                  {o.count === 0 ? "none" : o.count.toLocaleString()}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      {!shown.length && <p className="px-1 text-sm text-muted-foreground">Nothing matches “{q}”</p>}
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="px-1 text-xs underline underline-offset-2">
          Show {hidden.toLocaleString()} more
        </button>
      )}
    </div>
  );
}
