import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Days across, rows down, hours typed in the cells, totals on both edges.
 *
 * `spreadsheet-grid` IS GENERIC CELLS with no contract about what a row or a
 * column means. A timesheet's whole value is the two totals: the row total
 * says what a project cost, the column total says whether a day adds up to a
 * real working day, and the disagreement between them is the error people
 * are actually looking for.
 *
 * THE TOTALS ARE COMPUTED, NEVER TAKEN AS PROPS — a stored total that
 * disagrees with its cells is the bug this shape exists to prevent.
 *
 * A DAY OVER ITS EXPECTED HOURS IS FLAGGED IN THE COLUMN TOTAL, in weight
 * and words, not colour: fourteen hours on a Tuesday is usually a typo in
 * one cell, and the column total is where it is visible.
 *
 * Empty is empty, not zero (the decision-matrix rule): a blank cell means
 * "not worked on", and typing 0 means "worked on, achieved nothing" — they
 * are different claims and the grid keeps them apart.
 */
export function TimesheetGrid({ rows, days, values, onChange, expectedPerDay = 8, format, className }: {
  rows: { key: string; label: React.ReactNode }[];
  days: { key: string; label: React.ReactNode }[];
  /** `${rowKey}:${dayKey}` -> hours; absent means not worked on. */
  values: Record<string, number>;
  onChange?: (key: string, hours: number | null) => void;
  expectedPerDay?: number;
  format?: (h: number) => string;
  className?: string;
}) {
  const fmt = format ?? ((h: number) => (Math.round(h * 100) / 100).toString());
  const dayTotal = (d: string) => rows.reduce((s, r) => s + (values[`${r.key}:${d}`] ?? 0), 0);
  const rowTotal = (r: string) => days.reduce((s, d) => s + (values[`${r}:${d.key}`] ?? 0), 0);
  const grand = rows.reduce((s, r) => s + rowTotal(r.key), 0);

  return (
    <table className={cn("text-xs", className)}>
      <thead>
        <tr className="border-b border-border">
          <th className="pb-1 text-left font-medium">Project</th>
          {days.map((d) => <th key={d.key} className="px-1 pb-1 font-medium">{d.label}</th>)}
          <th className="pl-2 pb-1 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-border">
            <th scope="row" className="py-0.5 pr-2 text-left font-normal">{r.label}</th>
            {days.map((d) => {
              const key = `${r.key}:${d.key}`;
              const v = values[key];
              return (
                <td key={d.key} className="p-0.5">
                  <input
                    inputMode="decimal"
                    value={v == null ? "" : fmt(v)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      // "" is not worked on; "0" is worked on and got nowhere.
                      if (raw === "") return onChange?.(key, null);
                      const n = Number(raw);
                      if (!Number.isNaN(n) && n >= 0) onChange?.(key, n);
                    }}
                    aria-label={`${String(r.label)} on ${String(d.label)}`}
                    className="h-7 w-12 rounded border border-input bg-background text-center tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </td>
              );
            })}
            <td className="pl-2 text-right font-medium tabular-nums">{fmt(rowTotal(r.key))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="pt-1 text-left font-medium">Day total</th>
          {days.map((d) => {
            const t = dayTotal(d.key);
            const over = t > expectedPerDay;
            return (
              <td key={d.key} className={cn("px-1 pt-1 text-center tabular-nums", over ? "font-bold" : "text-muted-foreground")}
                title={over ? `Over the expected ${expectedPerDay}h` : undefined}>
                {fmt(t)}
                {over ? <span className="sr-only"> — over the expected {expectedPerDay} hours</span> : null}
              </td>
            );
          })}
          <td className="pl-2 pt-1 text-right font-bold tabular-nums">{fmt(grand)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
