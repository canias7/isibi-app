import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A calendar of counts — weeks across, days down, each cell filled by volume.
 *
 * TWO DIMENSIONS, WHICH `heat-strip` HAS NOT GOT and `mini-bars` cannot be:
 * the point is comparing the same weekday across many weeks (every Saturday
 * is busy) as well as reading one week, and only a grid shows both at once.
 *
 * FILL IS QUANTISED TO FIVE STEPS, NOT CONTINUOUS. A smooth opacity ramp is
 * unreadable — nobody can tell 0.42 from 0.51 — so counts bucket into five
 * levels with a legend that states the range of each. Monochrome, so the
 * levels survive greyscale by construction.
 *
 * EMPTY AND ZERO ARE DIFFERENT CELLS. A day before the data starts is
 * hollow and dashed; a day with genuinely zero is a plain empty square. A
 * heatmap that draws them alike says the shop was shut when it was simply
 * quiet.
 *
 * RAGGED ROWS ARE ALLOWED, which is what makes this the retention triangle
 * too: pass fewer cells for later rows and it renders short rather than
 * padding with fakes.
 */
export type HeatCell = { key: string; value: number | null; label?: string };

export function HeatmapGrid({ rows, rowLabels, colLabels, max, legendUnit = "", className }: {
  /** rows[r][c] — a null value means "no data", not zero. Rows may be short. */
  rows: HeatCell[][];
  rowLabels?: React.ReactNode[];
  colLabels?: React.ReactNode[];
  max?: number;
  legendUnit?: string;
  className?: string;
}) {
  const top = max ?? Math.max(1, ...rows.flat().map((c) => c.value ?? 0));
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / top) * 4)));
  const FILL = ["bg-transparent", "bg-foreground/20", "bg-foreground/40", "bg-foreground/65", "bg-foreground"];
  const width = Math.max(...rows.map((r) => r.length), 0);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: "2px" }}>
          {colLabels ? (
            <thead>
              <tr>
                {rowLabels ? <th /> : null}
                {Array.from({ length: width }, (_, c) => (
                  <th key={c} className="text-[9px] font-normal text-muted-foreground">{colLabels[c]}</th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {rowLabels ? (
                  <th scope="row" className="pe-1 text-end text-[10px] font-normal text-muted-foreground">{rowLabels[r]}</th>
                ) : null}
                {row.map((cell) => (
                  <td key={cell.key}>
                    {/* no data is dashed and hollow; a real zero is a plain square */}
                    <span title={cell.label}
                      className={cn("block size-3.5 rounded-[2px]",
                        cell.value == null
                          ? "border border-dashed border-border"
                          : cn("border border-border", FILL[level(cell.value)]))} />
                    <span className="sr-only">
                      {cell.label ?? cell.key}: {cell.value == null ? "no data" : cell.value}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>0</span>
        {FILL.map((f, i) => <span key={i} className={cn("size-2.5 rounded-[2px] border border-border", f)} />)}
        <span className="tabular-nums">{top}{legendUnit}</span>
        <span className="ms-1">· dashed means no data</span>
      </p>
    </div>
  );
}
