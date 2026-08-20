import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A grid of intensity — rows against columns, each cell shaded by its value.
 * A heatmap, without a chart library.
 *
 * The shade is never the only channel. Every cell prints its NUMBER as well,
 * and the accessible name spells out the row, the column and the value —
 * because a monochrome ramp has perhaps four steps anyone can reliably tell
 * apart, and the reader who needs the sixth is the one this table was built
 * for. Shading is for the scan; the number is for the answer.
 *
 * The ramp is built from opacity over `--foreground`, which is why it survives
 * a light and a dark theme without a second palette and stays inside the
 * black-and-white brand.
 *
 * An ABSENT cell is a dash, not the lightest shade — "quietest hour" and
 * "closed that day" are different facts, and one shade for both is the mistake
 * that makes a heatmap tell people to open on a Sunday. It has to be a dash
 * rather than an empty dashed box: rendered empty, three of them in a row read
 * as a loading skeleton, which is what they looked like the first time this was
 * photographed.
 *
 * The text flips to the background colour past the CROSSOVER, not at the
 * midpoint. A cell at half intensity is a mid grey, where one ink is around
 * 5.5:1 and the other around 3.4:1 — so the naive "past halfway, go light"
 * makes the middle of the ramp the least readable part of the table.
 *
 * THE CROSSOVER IS NOT THE SAME IN BOTH THEMES, and a single 0.66 was
 * calibrated on the light one only — which is how this shipped with unreadable
 * cells in dark and nothing noticed. Measured against the template's own
 * tokens, at a 4.5:1 bar:
 *
 *   light  the page ink reads to t=0.620, the reverse from t=0.625
 *   dark   the page ink reads to t=0.505, the reverse from t=0.530
 *
 * So dark crosses over a full tenth of the ramp earlier, and every cell in
 * 0.53..0.66 was printed in the ink with LESS contrast — down to 2.99:1 at
 * the top of that band, measured. Both flips are emitted and CSS picks.
 *
 * THE RESIDUE, STATED RATHER THAN PAPERED OVER: at the crossover itself the
 * best either ink can do is 4.40:1 in dark and 4.50:1 in light, so a sliver of
 * the ramp sits just under AA. That is INHERENT to printing text on a shade
 * rather than a bug in these numbers — the theoretical ceiling with pure black
 * and pure white is 4.59:1, and with this template's own inks it is 4.49:1.
 * Measured three ways before settling: shortening the ramp to 72% or 62% moves
 * the band and does not remove it (4.39:1), and flipping to pure black instead
 * of `--background` gets 4.49:1. Closing it properly means not putting the
 * number on the shade at all, which is a different component.
 *
 * Both numbers are calibrated on the DEFAULT palette. A generated site can
 * move `--foreground` and `--background`, which moves the crossover with them;
 * that was equally true of the single 0.66 and is strictly less wrong now.
 */
const FLIP_LIGHT = 0.62;
const FLIP_DARK = 0.52;

export function MatrixTable({
  rows, columns, value, format, rowLabel, max, className,
}: {
  rows: string[];
  columns: string[];
  value: (row: string, column: string) => number | null | undefined;
  format?: (n: number) => string;
  rowLabel?: React.ReactNode;
  max?: number;
  className?: string;
}) {
  const top = React.useMemo(() => {
    // A `max` OF ZERO IS A REAL CALL, AND IT USED TO PAINT EVERY CELL `NaN`.
    // The obvious page writes `max={plan.capacity}` or `max={Math.max(...counts)}`,
    // and both are 0 on a fresh site with nothing in it — then `v / top` is
    // `0 / 0`, and `Math.min(1, Math.max(0, NaN))` is NaN, because both of those
    // pass NaN straight through rather than clamping it. What reaches the page is
    // `color-mix(… NaN%, transparent)`, which the browser drops entirely: the
    // whole grid renders unshaded and looks like a table nobody filled in.
    //
    // The derived branch below already knew this — `m || 1` is the same guard —
    // so it was one branch protected and the other not. A non-positive or
    // unreadable `max` falls through to the derivation, which answers with the
    // real ceiling of the data when there is one and 1 when there is not.
    if (max != null && Number.isFinite(max) && max > 0) return max;
    let m = 0;
    for (const r of rows) for (const c of columns) {
      const v = value(r, c);
      if (typeof v === "number" && Number.isFinite(v)) m = Math.max(m, v);
    }
    return m || 1;
  }, [rows, columns, value, max]);

  const fmt = format ?? ((n: number) => n.toLocaleString());

  return (
    <div className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2 text-start font-medium">{rowLabel}</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-2 py-2 text-center text-xs font-medium whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-1.5 text-start font-medium whitespace-nowrap">{r}</th>
              {columns.map((c) => {
                const v = value(r, c);
                const has = typeof v === "number" && Number.isFinite(v);
                const t = has ? Math.min(1, Math.max(0, v / top)) : 0;
                return (
                  <td key={c} className="p-0.5">
                    <div
                      title={has ? `${r}, ${c}: ${fmt(v)}` : `${r}, ${c}: no data`}
                      aria-label={has ? `${r}, ${c}: ${fmt(v)}` : `${r}, ${c}: no data`}
                      style={has ? { backgroundColor: `color-mix(in oklab, var(--foreground) ${Math.round(t * 88)}%, transparent)` } : undefined}
                      className={cn("flex min-w-10 items-center justify-center rounded-sm px-1.5 py-1.5 text-xs tabular-nums",
                        !has && "border border-dashed border-border text-muted-foreground",
                        // BOTH DECISIONS ARE EMITTED AND CSS PICKS, because the
                        // two themes cross over at different points and the
                        // component is prerendered — it cannot know which theme
                        // the page will be in. The `dark:` variant is
                        // `&:is(.dark *)`, so it outranks the bare class in dark
                        // and does not apply at all in light.
                        has && (t > FLIP_LIGHT ? "font-medium text-background" : "text-foreground"),
                        has && (t > FLIP_DARK ? "dark:font-medium dark:text-background" : "dark:text-foreground"))}>
                      {has ? fmt(v) : "–"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
