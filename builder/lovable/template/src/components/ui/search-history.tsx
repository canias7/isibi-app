import * as React from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Previous searches, shown when the box is empty.
 *
 * IT CAN BE CLEARED, item by item and all at once. A list of what somebody has
 * searched for is a record of what they were looking into, and on a shared
 * machine that is genuinely sensitive — a history with no delete is a feature
 * people quite reasonably resent.
 *
 * It stores QUERIES, never results. A cached result set goes stale and shows
 * somebody a booking that has since been cancelled; re-running the search is
 * cheap and correct.
 *
 * Duplicates collapse to the most recent, like `recent-nav`: searching the same
 * thing three times should not fill the list with it.
 *
 * A query that returned NOTHING is still recorded, marked. Repeating a fruitless
 * search is exactly the mistake this list can prevent.
 */
export function SearchHistory({ items, onPick, onRemove, onClear, title = "Recent searches", className }: {
  items: { query: string; at?: React.ReactNode; empty?: boolean }[];
  onPick: (query: string) => void;
  onRemove?: (query: string) => void;
  onClear?: () => void;
  title?: React.ReactNode;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Clock aria-hidden className="size-3" /> {title}
        </p>
        {onClear ? (
          <button type="button" onClick={onClear}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Clear
          </button>
        ) : null}
      </div>
      <ul>
        {items.map((i) => (
          <li key={i.query} className="group/h flex items-center">
            <button type="button" onClick={() => onPick(i.query)}
              className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted">
              <span className="min-w-0 flex-1 truncate">{i.query}</span>
              {i.empty ? <span className="shrink-0 text-[11px] text-muted-foreground">no results</span> : null}
              {i.at ? <span className="shrink-0 text-[11px] text-muted-foreground">{i.at}</span> : null}
            </button>
            {onRemove ? (
              <button type="button" onClick={() => onRemove(i.query)} aria-label={`Remove “${i.query}” from history`}
                className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/h:opacity-100 focus-visible:opacity-100 hover:text-foreground">
                <X aria-hidden className="size-3" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
