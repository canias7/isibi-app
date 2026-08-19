import { cn } from "@/lib/utils";
/**
 * Which rows failed, by line number, and why.
 *
 * The LINE NUMBER is what makes this useful — it is how somebody finds the
 * row again in the spreadsheet they imported from. An error list without one
 * means opening the file and reading four hundred rows to find the two bad
 * ones.
 *
 * Line numbers are 1-based and count the header, matching what the
 * spreadsheet shows down its left edge. Off by one here and every reference
 * points at the wrong row.
 */
export function RowErrors({ errors, max = 20, className }: {
  errors: { line: number; column?: string; message: string }[];
  max?: number; className?: string;
}) {
  if (!errors.length) return null;
  const shown = errors.slice(0, max);
  return (
    <div className={cn("space-y-2", className)}>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {shown.map((e, i) => (
          <li key={i} className="flex gap-3 px-3 py-2">
            <span className="w-16 shrink-0 tabular-nums text-muted-foreground">Row {e.line}</span>
            <span className="min-w-0 flex-1">
              {e.column && <span className="me-1.5 font-medium">{e.column}:</span>}
              {e.message}
            </span>
          </li>
        ))}
      </ul>
      {errors.length > shown.length && (
        <p className="text-xs text-muted-foreground">
          and {(errors.length - shown.length).toLocaleString()} more.
        </p>
      )}
    </div>
  );
}
