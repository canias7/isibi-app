import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A crosstab: flat rows in, rows x columns out, with totals on both edges.
 *
 * The TOTALS are why this exists rather than a `<table>` of grouped rows.
 * "Bookings by barber by day" is only useful next to "and 61 of them were on
 * Saturday" — a pivot without margins makes the reader add up a column by eye,
 * which is the arithmetic they opened the report to avoid.
 *
 * `aggregate` defaults to a SUM of `value`, and `count` is offered as a named
 * option because counting rows is the most common pivot of all and expressing
 * it as "sum of 1" is a thing people get wrong.
 *
 * A cell with no rows behind it is an em dash, never a zero: "no appointments
 * were booked" and "appointments were booked and they came to nothing" are
 * different facts and a report that prints 0 for both is lying about one.
 */
export function PivotTable<T>({
  rows, rowKey, colKey, value, aggregate = "sum", format, rowLabel, className,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  colKey: (row: T) => string;
  value?: (row: T) => number;
  aggregate?: "sum" | "count" | "avg";
  format?: (n: number) => string;
  rowLabel?: string;
  className?: string;
}) {
  const { rowNames, colNames, cells, rowTotals, colTotals, grand } = React.useMemo(() => {
    const rs: string[] = [], cs: string[] = [];
    const acc = new Map<string, { sum: number; n: number }>();
    for (const row of rows) {
      const r = rowKey(row), c = colKey(row);
      if (!rs.includes(r)) rs.push(r);
      if (!cs.includes(c)) cs.push(c);
      const v = value ? value(row) : 1;
      const k = r + "\u0000" + c;
      const cur = acc.get(k) ?? { sum: 0, n: 0 };
      acc.set(k, { sum: cur.sum + (Number.isFinite(v) ? v : 0), n: cur.n + 1 });
    }
    const reduce = (a?: { sum: number; n: number }) =>
      !a || a.n === 0 ? null
        : aggregate === "count" ? a.n
        : aggregate === "avg" ? a.sum / a.n
        : a.sum;
    const cellMap = new Map<string, number | null>();
    const rt = new Map<string, { sum: number; n: number }>();
    const ct = new Map<string, { sum: number; n: number }>();
    let g = { sum: 0, n: 0 };
    for (const r of rs) for (const c of cs) {
      const a = acc.get(r + "\u0000" + c);
      cellMap.set(r + "\u0000" + c, reduce(a));
      if (!a) continue;
      const pr = rt.get(r) ?? { sum: 0, n: 0 };
      rt.set(r, { sum: pr.sum + a.sum, n: pr.n + a.n });
      const pc = ct.get(c) ?? { sum: 0, n: 0 };
      ct.set(c, { sum: pc.sum + a.sum, n: pc.n + a.n });
      g = { sum: g.sum + a.sum, n: g.n + a.n };
    }
    return {
      rowNames: rs, colNames: cs, cells: cellMap,
      rowTotals: new Map([...rt].map(([k, v2]) => [k, reduce(v2)])),
      colTotals: new Map([...ct].map(([k, v2]) => [k, reduce(v2)])),
      grand: reduce(g),
    };
  }, [rows, rowKey, colKey, value, aggregate]);

  const show = (n: number | null) =>
    n == null ? <span className="text-muted-foreground">&mdash;</span>
      : format ? format(n)
      : aggregate === "avg" ? n.toFixed(1)
      : n.toLocaleString();

  return (
    <div className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th scope="col" className="px-3 py-2 text-start font-medium">{rowLabel ?? ""}</th>
            {colNames.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 text-end font-medium whitespace-nowrap">{c}</th>
            ))}
            <th scope="col" className="px-3 py-2 text-end font-semibold whitespace-nowrap">Total</th>
          </tr>
        </thead>
        <tbody>
          {rowNames.map((r) => (
            <tr key={r} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-start font-medium whitespace-nowrap">{r}</th>
              {colNames.map((c) => (
                <td key={c} className="px-3 py-2 text-end tabular-nums">{show(cells.get(r + "\u0000" + c) ?? null)}</td>
              ))}
              <td className="px-3 py-2 text-end font-semibold tabular-nums">{show(rowTotals.get(r) ?? null)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/50">
            <th scope="row" className="px-3 py-2 text-start font-semibold">Total</th>
            {colNames.map((c) => (
              <td key={c} className="px-3 py-2 text-end font-semibold tabular-nums">{show(colTotals.get(c) ?? null)}</td>
            ))}
            <td className="px-3 py-2 text-end font-semibold tabular-nums">{show(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
