import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * One group of filter options, with counts.
 *
 * THE COUNTS ARE THE COMPONENT. A facet without them lets somebody pick an
 * option that returns nothing, which is the most annoying possible outcome of a
 * filter — and a zero-count option shown as available is a promise the list
 * cannot keep.
 *
 * ZERO-COUNT OPTIONS ARE DISABLED, NOT HIDDEN. Removing them makes the list
 * change shape as you filter, so the option you were reaching for moves under
 * the pointer; leaving them visible and disabled also tells you the category
 * exists, which is information.
 *
 * Long facets collapse to a "show all" rather than scrolling inside a tiny box,
 * which is unusable on touch.
 */
export function FacetList({ title, options, selected, onToggle, showAll, onShowAll, max = 6, className }: {
  title: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
  showAll?: boolean;
  onShowAll?: () => void;
  max?: number;
  className?: string;
}) {
  if (!options.length) return null;
  const shown = showAll ? options : options.slice(0, max);
  const rest = options.length - shown.length;
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      {shown.map((o) => {
        const none = o.count === 0;
        return (
          <label key={o.value}
            className={cn("flex items-center gap-2 text-sm", none ? "text-muted-foreground" : "cursor-pointer")}>
            <Checkbox checked={selected.includes(o.value)} disabled={none}
              onCheckedChange={() => onToggle(o.value)} aria-label={`${o.label}, ${o.count}`} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            <span className="shrink-0 text-xs tabular-nums">{o.count}</span>
          </label>
        );
      })}
      {rest > 0 && onShowAll && (
        <button type="button" onClick={onShowAll}
          className="w-fit cursor-pointer text-xs underline underline-offset-4 tabular-nums">Show all {options.length}</button>
      )}
    </fieldset>
  );
}
