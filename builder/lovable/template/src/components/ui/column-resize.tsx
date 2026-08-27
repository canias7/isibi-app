import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The drag handle on a column edge, plus the state that remembers the widths.
 *
 * There is a MINIMUM and it is not optional. Dragged to zero a column is not
 * narrow, it is gone — and it is gone along with the handle that would bring it
 * back, so the only recovery is a reload. 48px stays grabbable.
 *
 * The pointer is CAPTURED, so a drag that leaves the 4px handle (which is every
 * drag, because the pointer outruns the layout) keeps working, and a pointerup
 * anywhere on the page still ends it. `touch-none` is what stops a phone
 * scrolling the table instead of resizing the column.
 *
 * Arrow keys move it too, and double-click or Home RESETS that one column —
 * the escape hatch for a width dragged somewhere useless, an undo that needs no
 * history.
 */
export const MIN_COLUMN_WIDTH = 48;

export function useColumnWidths(initial: Record<string, number>) {
  const [widths, setWidths] = React.useState<Record<string, number>>(initial);
  const base = React.useRef(initial);
  const set = React.useCallback((key: string, px: number) => {
    setWidths((w) => ({ ...w, [key]: Math.max(MIN_COLUMN_WIDTH, Math.round(px)) }));
  }, []);
  const reset = React.useCallback((key?: string) => {
    setWidths((w) => (key ? { ...w, [key]: base.current[key] ?? 160 } : base.current));
  }, []);
  return { widths, set, reset };
}

export function ColumnResize({ width, onResize, onReset, label, className }: {
  width: number;
  onResize: (px: number) => void;
  onReset?: () => void;
  label?: string;
  className?: string;
}) {
  const start = React.useRef({ x: 0, w: 0 });
  const [dragging, setDragging] = React.useState(false);

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div data-slot="column-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={label ? `Resize ${label}` : "Resize column"}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start.current = { x: e.clientX, w: width };
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        onResize(Math.max(MIN_COLUMN_WIDTH, start.current.w + (e.clientX - start.current.x)));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") { e.preventDefault(); onResize(Math.max(MIN_COLUMN_WIDTH, width - 16)); }
        if (e.key === "ArrowRight") { e.preventDefault(); onResize(width + 16); }
        if (e.key === "Home") { e.preventDefault(); onReset?.(); }
      }}
      className={cn(
        "absolute top-0 end-0 h-full w-1 cursor-col-resize touch-none select-none",
        "hover:bg-foreground/30 focus-visible:bg-foreground/40 focus-visible:outline-none",
        dragging && "bg-foreground/40", className)}
    />
  );
}
