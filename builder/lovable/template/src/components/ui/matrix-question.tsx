import { cn } from "@/lib/utils";
/**
 * One question per row, one answer per column.
 *
 * The row label is repeated into every radio's `aria-label`, because a
 * screen reader moving cell by cell otherwise hears "option 3" with nothing
 * saying which question it belongs to — the failure that makes every matrix
 * survey unanswerable without sight.
 *
 * On a phone it becomes stacked groups: a five-column matrix at 375px is
 * five unhittable targets.
 */
export function MatrixQuestion({ name, rows, columns, value, onChange, className }: {
  name: string; rows: { key: string; label: string }[];
  columns: { value: string; label: string }[];
  value: Record<string, string>; onChange: (rowKey: string, v: string) => void;
  className?: string;
}) {
  return (
    <div data-slot="matrix-question" className={cn("space-y-4", className)}>
      {/* Stacked, below md. */}
      <div className="space-y-4 md:hidden">
        {rows.map((r) => (
          <fieldset key={r.key}>
            <legend className="mb-1.5 text-sm font-medium">{r.label}</legend>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <label key={c.value}
                  className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-xs",
                    value[r.key] === c.value ? "border-foreground bg-foreground text-background" : "border-border")}>
                  <input type="radio" className="sr-only" name={`${name}-${r.key}`} value={c.value}
                    checked={value[r.key] === c.value} onChange={() => onChange(r.key, c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {/* Grid, md and up. */}
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 text-start font-medium" />
            {columns.map((c) => (
              <th key={c.value} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <th scope="row" className="py-3 pe-4 text-start font-normal">{r.label}</th>
              {columns.map((c) => (
                <td key={c.value} className="py-3 text-center">
                  <input type="radio" name={`${name}-${r.key}`} value={c.value}
                    aria-label={`${r.label}: ${c.label}`}
                    checked={value[r.key] === c.value} onChange={() => onChange(r.key, c.value)}
                    className="size-4 accent-foreground" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
