import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The parts of the current query, each removable.
 *
 * A QUERY BUILT UP OVER SEVERAL ACTIONS BECOMES INVISIBLE. Somebody who typed a
 * term, picked a category and set a date range sees one list and cannot tell
 * which of the three is excluding the thing they are looking for. Chips make
 * each part separately removable, which is how people actually debug a search.
 *
 * EACH CHIP NAMES ITS FIELD — "Category: Repairs", not "Repairs". Without it a
 * row of bare values is ambiguous the moment two filters share a vocabulary.
 *
 * The remove button carries the whole chip in its accessible name, or a screen
 * reader gets six controls called "Remove".
 */
export function QueryChips({ parts, onRemove, onClearAll, className }: {
  parts: { key: string; field?: string; value: string }[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  className?: string;
}) {
  if (!parts.length) return null;
  return (
    <ul data-slot="query-chips" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {parts.map((p) => (
        <li key={p.key}>
          <span className="inline-flex items-center gap-1 rounded border border-border py-0.5 pe-0.5 ps-2 text-xs">
            {p.field && <span className="text-muted-foreground">{p.field}:</span>}
            <span className="max-w-40 truncate">{p.value}</span>
            <button type="button" onClick={() => onRemove(p.key)}
              aria-label={`Remove ${p.field ? `${p.field} ` : ""}${p.value}`}
              className="cursor-pointer rounded p-0.5 hover:bg-muted">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        </li>
      ))}
      {onClearAll && parts.length > 1 && (
        <li>
          <button type="button" onClick={onClearAll}
            className="cursor-pointer text-xs underline underline-offset-2">Clear all</button>
        </li>
      )}
    </ul>
  );
}
