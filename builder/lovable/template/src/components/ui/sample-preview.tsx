import { cn } from "@/lib/utils";
/**
 * The first few rows of a file, before importing it.
 *
 * NOBODY SHOULD IMPORT BLIND. A preview of five rows catches the wrong file, a
 * missing header row and a mis-detected delimiter — all of which are silent
 * disasters at 4,000 rows and obvious at five.
 *
 * IT SHOWS THE DETECTED HEADERS AS SUCH. The commonest import fault is a header
 * row treated as data, and it is invisible unless the preview distinguishes the
 * two — which is why the header is a real `<thead>`.
 *
 * THE TOTAL IS STATED, so "5 of 4,182 rows" makes clear this is a sample rather
 * than the whole file — a preview mistaken for the complete import is how people
 * conclude the upload lost their data.
 */
export function SamplePreview({ headers, rows, total, className }: {
  headers: string[];
  /** The first few, already parsed. */
  rows: string[][];
  total?: number;
  className?: string;
}) {
  if (!headers.length) return null;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-xs text-muted-foreground tabular-nums">
        Showing {rows.length}{typeof total === "number" ? ` of ${total.toLocaleString()}` : ""} rows
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {headers.map((h) => (
                <th key={h} scope="col" className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {r.map((c, j) => <td key={j} className="px-2 py-1 whitespace-nowrap">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
