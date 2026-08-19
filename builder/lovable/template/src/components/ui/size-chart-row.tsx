import { cn } from "@/lib/utils";
/**
 * One row of a sizing table, with the reader's own size marked.
 *
 * THE MARKED ROW IS WHAT THE COMPONENT IS FOR. A size chart is a wall of
 * numbers, and the only question anybody brings to it is "which line is me" —
 * so `you` marks it, and the mark is a WORD ("Your size") plus a heavier weight,
 * never a highlight colour. A tinted row says nothing in greyscale and nothing
 * at all to a screen reader.
 *
 * `<th scope="row">` on the size name, so a screen reader reading the fourth
 * cell announces "Medium, chest, 96 to 101" instead of a bare number. That one
 * attribute is the difference between a usable table and an unusable one, and
 * it is the thing hand-written markup always drops.
 *
 * MEASUREMENTS ARE RANGES because bodies are, and a chart giving one number per
 * size is the reason people order two and send one back. A single value is
 * still allowed for the charts that genuinely have one.
 *
 * Designed to sit inside the caller's `<table>` — it is one `<tr>`, so the
 * header row and the column set stay the caller's decision.
 */
export type SizeCell = { from: number; to?: number; unit?: string };

export function SizeChartRow({ size, cells, you, className }: {
  /** The size name — "M", "10", "42". */
  size: string;
  cells: SizeCell[];
  /** Marks this as the reader's size. */
  you?: boolean;
  className?: string;
}) {
  return (
    <tr className={cn(you && "font-medium", className)}>
      <th scope="row" className="px-3 py-2 text-start text-sm">
        {size}
        {you && <span className="ms-2 text-xs font-normal text-muted-foreground">Your size</span>}
      </th>
      {cells.map((c, i) => (
        <td key={i} className="px-3 py-2 text-end text-sm tabular-nums">
          {c.to !== undefined && c.to !== c.from ? `${c.from}–${c.to}` : c.from}
          {c.unit ? <span className="text-muted-foreground"> {c.unit}</span> : null}
        </td>
      ))}
    </tr>
  );
}
