import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * What goes into the export.
 *
 * THE SAME HAZARD AS `select-scope`, and worse. Exporting "everything" when you
 * meant the filtered 40 produces a 3 GB file and, on a shared drive, a data
 * exposure — and the difference is invisible on the button that starts it.
 *
 * EVERY OPTION CARRIES ITS ROW COUNT, because that is the only thing that makes
 * the choice assessable. "This page" and "Everything" are not comparable
 * quantities without them.
 *
 * COLUMNS ARE A SEPARATE QUESTION and stated as one. An export that silently
 * includes hidden columns is the commonest way a spreadsheet leaks a field
 * somebody deliberately hid from the table.
 */
export type ExportScopeKey = "page" | "filtered" | "all";

export function ExportScope({ value, onChange, counts, columnNote, className }: {
  value: ExportScopeKey;
  onChange: (v: ExportScopeKey) => void;
  counts: { page: number; filtered?: number; all: number };
  /** "Only the columns you can see" — or the opposite. */
  columnNote?: string;
  className?: string;
}) {
  const id = React.useId();
  const options: { key: ExportScopeKey; label: string; n: number }[] = [
    { key: "page", label: "This page", n: counts.page },
    ...(typeof counts.filtered === "number" && counts.filtered !== counts.all
      ? [{ key: "filtered" as const, label: "Matching the filter", n: counts.filtered }] : []),
    { key: "all", label: "Everything", n: counts.all },
  ];
  return (
    <fieldset data-slot="export-scope" className={cn("flex flex-col gap-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">Export</legend>
      <div role="radiogroup" aria-label="Export" className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.key} htmlFor={`${id}-${o.key}`}
            className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
              value === o.key ? "border-foreground font-medium" : "border-border")}>
            <input type="radio" id={`${id}-${o.key}`} name={id} checked={value === o.key}
              onChange={() => onChange(o.key)} className="size-3.5 accent-foreground" />
            {o.label}
            <span className="text-muted-foreground tabular-nums">{o.n.toLocaleString()}</span>
          </label>
        ))}
      </div>
      {columnNote && <p className="text-xs text-muted-foreground">{columnNote}</p>}
    </fieldset>
  );
}
