import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The last few queries.
 *
 * Each row carries its own remove button. Somebody's search history is the
 * kind of thing they want to take back one entry of, and "clear everything"
 * as the only option means they clear nothing.
 */
export function RecentSearches({ items, onSelect, onRemove, onClear, className }: {
  items: string[]; onSelect: (q: string) => void;
  onRemove?: (q: string) => void; onClear?: () => void; className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</span>
        {onClear && <button type="button" onClick={onClear}
          className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Clear</button>}
      </div>
      <ul>
        {items.map((q) => (
          <li key={q} className="group flex items-center gap-2 rounded px-2 hover:bg-muted">
            <button type="button" onClick={() => onSelect(q)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 text-left text-sm">
              <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{q}</span>
            </button>
            {onRemove && (
              <button type="button" onClick={() => onRemove(q)} aria-label={`Remove ${q}`}
                className="cursor-pointer p-1 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                <X className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
