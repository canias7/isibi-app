import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * A facet group with counts — Category, Price, Brand.
 *
 * A zero-count option is shown disabled rather than hidden: an option list
 * that reshuffles as you tick things makes it impossible to find the box you
 * were reaching for.
 */
export function SearchFacets({ title, options, selected, onToggle, className }: {
  title: string; options: { value: string; label: string; count?: number }[];
  selected: string[]; onToggle: (value: string) => void; className?: string;
}) {
  return (
    // `w-full min-w-0` because a <fieldset> sizes to min-content rather than
    // filling a flex parent, which collapses the count away from the label.
    <fieldset className={cn("w-full min-w-0 space-y-2", className)}>
      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</legend>
      {options.map((o) => {
        const id = `${title}-${o.value}`;
        const empty = o.count === 0 && !selected.includes(o.value);
        return (
          <div data-slot="search-facets" key={o.value} className="flex items-center gap-2">
            <Checkbox id={id} disabled={empty} checked={selected.includes(o.value)}
              onCheckedChange={() => onToggle(o.value)} />
            <Label htmlFor={id} className={cn("flex flex-1 justify-between gap-2 text-sm font-normal",
              empty && "text-muted-foreground")}>
              <span>{o.label}</span>
              {o.count != null && <span className="tabular-nums text-muted-foreground">{o.count}</span>}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}
