import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
/**
 * A list of thousands that only renders what is on screen.
 *
 * The threshold is real: past a few hundred rows the browser spends longer in
 * layout than anything else, and a table of 10,000 simply hangs. Below that,
 * a plain list is better — it is searchable with the browser's own find, and
 * this one is not.
 *
 * `estimateSize` may be wrong and the virtualiser measures the real height
 * afterwards, which is why rows are allowed to vary. What it must NOT do is
 * change height after measurement — an image loading inside a row shifts
 * everything below it, so rows containing images need a fixed aspect.
 */
export function VirtualList<T>({ items, renderRow, estimateSize = 44, overscan = 8, height = 400, className }: {
  items: T[]; renderRow: (item: T, index: number) => React.ReactNode;
  estimateSize?: number; overscan?: number; height?: number; className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const rows = useVirtualizer({
    count: items.length,
    getScrollElement: () => ref.current,
    estimateSize: () => estimateSize,
    overscan,
  });
  return (
    <div ref={ref} className={cn("overflow-y-auto", className)} style={{ height }}>
      <div style={{ height: rows.getTotalSize(), position: "relative" }}>
        {rows.getVirtualItems().map((v) => (
          <div key={v.key} ref={rows.measureElement} data-index={v.index}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${v.start}px)` }}>
            {renderRow(items[v.index], v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
