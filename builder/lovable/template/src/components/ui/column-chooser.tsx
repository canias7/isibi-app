import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * Which columns to show.
 *
 * THE LAST VISIBLE COLUMN CANNOT BE HIDDEN. A table with no columns is a blank
 * box the reader has no way to recover from, and it is reachable in three clicks
 * on every implementation that does not guard it.
 *
 * REQUIRED COLUMNS ARE DISABLED AND SAY SO. The name column of a list is not a
 * preference — hiding it leaves rows that cannot be told apart — and a checkbox
 * that silently refuses is worse than one that is visibly fixed.
 *
 * The count is stated, because "some columns are hidden" is the fact that
 * explains a missing figure, and a reader who does not know the chooser exists
 * will not go looking for it.
 */
export function ColumnChooser({ columns, onToggle, className }: {
  columns: { key: string; label: string; visible: boolean; required?: boolean }[];
  onToggle: (key: string) => void;
  className?: string;
}) {
  if (!columns.length) return null;
  const visible = columns.filter((c) => c.visible).length;
  const hidden = columns.length - visible;
  return (
    <fieldset data-slot="column-chooser" className={cn("flex flex-col gap-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">
        Columns{hidden > 0 && <span className="font-normal text-muted-foreground tabular-nums"> · {hidden} hidden</span>}
      </legend>
      {columns.map((c) => {
        const last = c.visible && visible <= 1;
        const fixed = c.required || last;
        return (
          <label key={c.key} className={cn("flex items-center gap-2 text-sm", fixed ? "text-muted-foreground" : "cursor-pointer")}>
            <Checkbox checked={c.visible} disabled={fixed} onCheckedChange={() => onToggle(c.key)} aria-label={c.label} />
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            {fixed && <span className="shrink-0 text-xs">{c.required ? "Always shown" : "Last one"}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
