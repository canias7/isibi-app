import { cn } from "@/lib/utils";
/**
 * A microplate layout — the grid, with what is in each well.
 *
 * IT IS A REAL TABLE WITH ROW AND COLUMN HEADERS, not a grid of divs. That one
 * decision is what makes the layout readable by a screen reader and navigable
 * by keyboard, and a plate map is otherwise among the least accessible things a
 * laboratory system displays.
 *
 * EMPTY WELLS ARE SHOWN AS EMPTY, not skipped. The pattern of what is not used
 * is as informative as what is — an edge-only gap is a deliberate evaporation
 * margin, and a random one is a pipetting error.
 *
 * CONTROLS ARE MARKED DISTINCTLY FROM SAMPLES BY LETTER, not by colour. A plate
 * map printed and taped to a bench is monochrome by the time anybody uses it.
 *
 * IT WARNS WHEN A PLATE HAS NO CONTROLS. A run without them cannot be
 * interpreted, and the moment to notice is while laying it out rather than
 * after reading it.
 */
export type Well = { id: string; row: string; column: number; label?: string; kind?: "sample" | "control" | "blank" | "standard" };

const MARK: Record<string, string> = { sample: "S", control: "C", blank: "B", standard: "T" };

export function AssayPlate({ rows = ["A", "B", "C", "D", "E", "F", "G", "H"], columns = 12, wells, className }: {
  rows?: string[];
  columns?: number;
  wells: Well[];
  className?: string;
}) {
  const at = new Map(wells.map((w) => [`${w.row}${w.column}`, w]));
  const controls = wells.filter((w) => w.kind === "control").length;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <caption className="sr-only">
            Plate layout. S is a sample, C a control, B a blank, T a standard. An empty cell is an unused well.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sr-only">Row</th>
              {Array.from({ length: columns }, (_, i) => (
                <th key={i} scope="col" className="px-1 py-0.5 text-center font-normal tabular-nums text-muted-foreground">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th scope="row" className="pr-1 text-right font-normal text-muted-foreground">{r}</th>
                {Array.from({ length: columns }, (_, i) => {
                  const w = at.get(`${r}${i + 1}`);
                  return (
                    <td key={i} className="border border-border p-0">
                      <span className="flex h-6 w-6 items-center justify-center font-mono">
                        {w ? MARK[w.kind ?? "sample"] : ""}
                        <span className="sr-only">
                          {r}{i + 1}{w ? `, ${w.kind ?? "sample"}${w.label ? `, ${w.label}` : ""}` : ", empty"}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {wells.length} of {rows.length * columns} wells used · S sample · C control · B blank · T standard
      </p>
      {controls === 0 && (
        <p className="text-xs font-medium">No controls on this plate — the run cannot be interpreted.</p>
      )}
    </div>
  );
}
