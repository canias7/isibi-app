import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Two or three things picked out of a list and put next to each other.
 *
 * IT IS CAPPED AT THREE. Four columns on a laptop are too narrow to read and on
 * a phone they are unusable; every comparison tool that allows more ends up
 * with a horizontal scroll that defeats the point of comparing. The cap is
 * enforced and the add control says so when it is reached.
 *
 * EACH COLUMN CAN BE REMOVED from the comparison without leaving it, so
 * swapping the third option is one press rather than a return to the list.
 *
 * ROWS ALIGN ACROSS COLUMNS. Rendering each option as an independent card means
 * "price" is at a different height in each one and the eye cannot travel
 * sideways, which is the entire mechanism of a comparison.
 *
 * On a phone it SCROLLS SIDEWAYS with the attribute column frozen rather than
 * stacking, for the reason `comparison-columns` gives: stacking turns comparing
 * into remembering.
 */
export function SideBySide({ items, rows, onRemove, onAdd, max = 3, className }: {
  items: { key: string; title: React.ReactNode; subtitle?: React.ReactNode }[];
  rows: { key: string; label: React.ReactNode; render: (itemKey: string) => React.ReactNode }[];
  onRemove?: (key: string) => void;
  onAdd?: () => void;
  max?: number;
  className?: string;
}) {
  const shown = items.slice(0, max);
  return (
    <div data-slot="side-by-side" className={cn("flex flex-col gap-2", className)}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="sticky start-0 z-1 bg-muted px-3 py-2 text-start font-medium" />
              {shown.map((i) => (
                <th key={i.key} scope="col" className="min-w-32 bg-muted px-3 py-2 text-start align-top font-semibold">
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block">{i.title}</span>
                      {i.subtitle ? <span className="block text-xs font-normal text-muted-foreground">{i.subtitle}</span> : null}
                    </span>
                    {onRemove ? (
                      <button type="button" onClick={() => onRemove(i.key)}
                        aria-label={`Remove ${typeof i.title === "string" ? i.title : "this option"} from the comparison`}
                        className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground">
                        <X aria-hidden className="size-3" />
                      </button>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-0">
                {/* Aligned rows: independent cards make the eye travel vertically. */}
                <th scope="row" className="sticky start-0 z-1 bg-background px-3 py-2 text-start font-normal whitespace-nowrap text-muted-foreground">
                  {r.label}
                </th>
                {shown.map((i) => (
                  <td key={i.key} className="px-3 py-2">{r.render(i.key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onAdd ? (
        <button type="button" onClick={onAdd} disabled={items.length >= max}
          className="cursor-pointer self-start text-xs underline underline-offset-2 disabled:pointer-events-none disabled:text-muted-foreground disabled:no-underline">
          {items.length >= max ? `${max} is the most you can compare at once` : "Add another to compare"}
        </button>
      ) : null}
    </div>
  );
}
