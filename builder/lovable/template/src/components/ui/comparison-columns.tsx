import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Two or three things side by side, one attribute per row — the shape a
 * customer uses to choose between a Bronze, Silver and Gold package.
 *
 * The DIFFERENCES can be isolated. On a table of eighteen rows where fourteen
 * are identical, the four that differ are the entire decision, and finding them
 * by eye across three columns is what makes people give up and pick the middle
 * one. `onlyDifferences` hides the rows where every column says the same thing,
 * and says how many it hid — a filter that silently removes rows is the bug
 * this kit keeps refusing to ship.
 *
 * On a phone this stays a table and SCROLLS sideways, with the attribute column
 * frozen. Stacking each option into its own card is the usual responsive answer
 * and it destroys the comparison: the reader is now flipping between blocks,
 * remembering values, which is exactly the work the layout existed to remove.
 */
export function ComparisonColumns({
  options, rows, highlight, onlyDifferences, className,
}: {
  options: { key: string; label: React.ReactNode; note?: React.ReactNode }[];
  rows: { key: string; label: React.ReactNode; values: Record<string, React.ReactNode> }[];
  highlight?: string;
  onlyDifferences?: boolean;
  className?: string;
}) {
  const same = (r: (typeof rows)[number]) => {
    const first = String(r.values[options[0]?.key] ?? "");
    return options.every((o) => String(r.values[o.key] ?? "") === first);
  };
  const shown = onlyDifferences ? rows.filter((r) => !same(r)) : rows;
  const hidden = rows.length - shown.length;

  return (
    <div data-slot="comparison-columns" className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky start-0 z-1 bg-muted px-3 py-2 text-start font-medium" />
            {options.map((o) => (
              <th key={o.key} scope="col"
                className={cn("min-w-32 bg-muted px-3 py-2 text-start align-top font-semibold",
                  o.key === highlight && "bg-foreground text-background")}>
                <span className="block">{o.label}</span>
                {o.note ? (
                  <span className={cn("block text-xs font-normal",
                    o.key === highlight ? "text-background/80" : "text-muted-foreground")}>{o.note}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <th scope="row" className="sticky start-0 z-1 bg-background px-3 py-2 text-start font-normal text-muted-foreground whitespace-nowrap">
                {r.label}
              </th>
              {options.map((o) => (
                <td key={o.key} className={cn("px-3 py-2", o.key === highlight && "bg-muted/60 font-medium")}>
                  {r.values[o.key] ?? <span className="text-muted-foreground">&mdash;</span>}
                </td>
              ))}
            </tr>
          ))}
          {shown.length === 0 ? (
            <tr>
              <td colSpan={options.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                These options are identical on every line.
              </td>
            </tr>
          ) : null}
        </tbody>
        {hidden > 0 ? (
          <tfoot>
            <tr className="border-t border-border bg-muted/40">
              <td colSpan={options.length + 1} className="px-3 py-2 text-xs text-muted-foreground">
                {hidden} {hidden === 1 ? "line is" : "lines are"} the same across every option and {hidden === 1 ? "is" : "are"} hidden.
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
