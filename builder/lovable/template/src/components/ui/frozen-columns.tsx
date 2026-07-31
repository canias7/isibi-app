import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A wide table whose first columns stay put while the rest scrolls.
 *
 * The BOUNDARY has to be visible. With no marking at the freeze line, content
 * sliding under the frozen columns reads as content being deleted — the eye has
 * nothing to tell it that a column is passing behind rather than ending. So the
 * last frozen column carries a right border and a small shadow, and the shadow
 * appears only once the body has actually been scrolled, or a table that fits
 * gets a permanent seam down it for no reason.
 *
 * `left` is CUMULATIVE and computed from the widths, because `position:sticky`
 * needs an absolute offset per column; sticking them all at 0 stacks them on
 * top of each other and shows only the last.
 */
export function FrozenColumns<T>({
  rows, columns, freeze = 1, rowKey, empty = "Nothing to show.", className,
}: {
  rows: T[];
  columns: { key: string; header: React.ReactNode; cell: (row: T) => React.ReactNode; width?: number; align?: "left" | "right" }[];
  freeze?: number;
  rowKey: (row: T, index: number) => React.Key;
  empty?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const n = Math.max(0, Math.min(freeze, columns.length));
  const offsets = React.useMemo(() => {
    const out: number[] = [];
    let x = 0;
    for (let i = 0; i < n; i++) { out.push(x); x += columns[i]?.width ?? 160; }
    return out;
  }, [columns, n]);

  const stick = (i: number): React.CSSProperties => i < n
    ? { position: "sticky", left: offsets[i], zIndex: 1, width: columns[i].width ?? 160, minWidth: columns[i].width ?? 160 }
    : { width: columns[i].width, minWidth: columns[i].width };

  const edge = (i: number) => cn(
    i === n - 1 && "border-r border-border",
    i === n - 1 && scrolled && "shadow-[2px_0_4px_-1px_rgba(0,0,0,0.15)]");

  return (
    <div
      ref={ref}
      onScroll={() => setScrolled((ref.current?.scrollLeft ?? 0) > 0)}
      className={cn("overflow-x-auto rounded-md border border-border", className)}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c, i) => (
              <th key={c.key} scope="col" style={stick(i)}
                className={cn("bg-muted px-3 py-2 font-medium whitespace-nowrap",
                  c.align === "right" ? "text-right" : "text-left", edge(i))}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">{empty}</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={rowKey(row, ri)} className="border-b border-border last:border-0">
              {columns.map((c, i) => (
                <td key={c.key} style={stick(i)}
                  className={cn("bg-background px-3 py-2 whitespace-nowrap",
                    c.align === "right" ? "text-right tabular-nums" : "text-left", edge(i))}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
