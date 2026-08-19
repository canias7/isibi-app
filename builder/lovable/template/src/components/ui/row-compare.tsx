import { cn } from "@/lib/utils";
/**
 * Two or three rows lifted out of a table and set side by side.
 *
 * DIFFERENCES ONLY, optionally — which is the whole reason this beats reading
 * the rows in place. Comparing three suppliers across twenty identical fields is
 * work; comparing the four fields where they differ is a decision.
 *
 * IT IS A REAL TABLE with the attributes as row headers, so a screen reader
 * announces "Price, Yard A, £2,650" rather than a stream of values. Transposing
 * a comparison is exactly where markup usually degenerates into divs.
 *
 * Rows that are identical across every subject are dropped when `differencesOnly`
 * is set, and the count of what was hidden is stated — a silent filter on a
 * comparison is how somebody concludes two things are more different than they
 * are.
 */
export function RowCompare({ subjects, attributes, differencesOnly, className }: {
  /** Column headers — the things being compared. */
  subjects: string[];
  /** One per row: the attribute and its value per subject. */
  attributes: { label: string; values: (string | number | null)[] }[];
  differencesOnly?: boolean;
  className?: string;
}) {
  if (!subjects.length || !attributes.length) return null;
  const same = (v: (string | number | null)[]) => v.every((x) => String(x ?? "") === String(v[0] ?? ""));
  const rows = differencesOnly ? attributes.filter((a) => !same(a.values)) : attributes;
  const hidden = attributes.length - rows.length;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2 text-start text-xs font-normal text-muted-foreground">Attribute</th>
            {subjects.map((s) => (
              <th key={s} scope="col" className="px-3 py-2 text-start font-medium">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.label} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-start font-normal text-muted-foreground">{a.label}</th>
              {a.values.map((v, i) => (
                <td key={i} className="px-3 py-2 tabular-nums">
                  {v === null || v === undefined || v === "" ? <span className="text-muted-foreground italic">—</span> : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">{hidden} identical {hidden === 1 ? "row" : "rows"} hidden</p>
      )}
    </div>
  );
}
