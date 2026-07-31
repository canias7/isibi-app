import * as React from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Moving a column, by dragging OR by two buttons.
 *
 * The buttons are the point. Drag-only reordering is unreachable from a
 * keyboard and from most assistive technology, so column order — which on a
 * report is often the difference between readable and not — becomes a mouse
 * privilege. They are real buttons, so focus and Enter work without anything
 * having to be intercepted.
 *
 * The drop TARGET is an edge, not the whole cell: dropping "onto" a header is
 * ambiguous about which side, and a half-width hit area on each side answers
 * that with the pointer position rather than with a rule to be learned.
 *
 * Dropping right of a column that sits LEFT of the dragged one is off by one
 * once the dragged column is removed, so the index is decremented — the classic
 * reorder bug, where every drag lands one place short of where it was dropped.
 *
 * A header carrying this is FOUR elements wide, so the table wants an
 * `overflow-x-auto` wrapper. Without one it silently clips the last column's
 * arrows off the right edge, which is how it rendered the first time.
 */
export function ColumnReorder({ index, count, label, onMove, className }: {
  index: number;
  count: number;
  label: string;
  onMove: (from: number, to: number) => void;
  className?: string;
}) {
  const [over, setOver] = React.useState<"left" | "right" | null>(null);
  return (
    <span
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(index)); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setOver(e.clientX < r.left + r.width / 2 ? "left" : "right");
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        const side = over;
        setOver(null);
        if (!Number.isInteger(from) || from === index) return;
        let to = side === "right" ? index + 1 : index;
        if (from < to) to -= 1;
        if (to !== from) onMove(from, to);
      }}
      className={cn("inline-flex items-center gap-1",
        over === "left" && "shadow-[inset_2px_0_0_0_currentColor]",
        over === "right" && "shadow-[inset_-2px_0_0_0_currentColor]", className)}
    >
      <GripVertical aria-hidden className="size-3.5 cursor-grab text-muted-foreground" />
      <span>{label}</span>
      <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)}
        aria-label={`Move ${label} left`}
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
        <ChevronLeft aria-hidden className="size-3.5" />
      </button>
      <button type="button" disabled={index === count - 1} onClick={() => onMove(index, index + 1)}
        aria-label={`Move ${label} right`}
        className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
        <ChevronRight aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}

/** Move one item, returning a new array. Exported because every caller needs it. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
