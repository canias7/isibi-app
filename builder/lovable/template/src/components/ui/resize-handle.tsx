import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The bar you drag to resize a panel.
 *
 * IT IS A `role="separator"` WITH ARROW KEYS. A pane split is a layout decision
 * people make constantly — hiding a sidebar, widening a preview — and a
 * drag-only handle puts that out of reach of a keyboard entirely. `aria-valuenow`
 * is what makes the current split announceable.
 *
 * There is a MINIMUM AND A MAXIMUM, and both are enforced here rather than
 * left to the caller. Dragged to zero, a panel is not narrow — it is gone,
 * along with the handle that would bring it back, so the only recovery is a
 * reload. Same reasoning as `column-resize`.
 *
 * Double-click RESETS to the default, which is the escape hatch for a split
 * dragged somewhere useless without needing an undo history.
 *
 * The pointer is CAPTURED so a fast drag that outruns the 6px bar keeps
 * working, and `touch-none` stops a phone scrolling the page instead.
 * `select-none` on the body during a drag is what stops the whole layout being
 * highlighted blue as the pointer sweeps across it.
 */
export function ResizeHandle({
  value, onChange, onReset, min = 15, max = 85, orientation = "vertical", label = "Resize panel", className,
}: {
  value: number;
  onChange: (percent: number) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  orientation?: "vertical" | "horizontal";
  label?: string;
  className?: string;
}) {
  const [dragging, setDragging] = React.useState(false);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  React.useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => { document.body.style.userSelect = prev; };
  }, [dragging]);

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => { setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const parent = e.currentTarget.parentElement;
        if (!parent) return;
        const r = parent.getBoundingClientRect();
        onChange(clamp(orientation === "vertical"
          ? ((e.clientX - r.left) / r.width) * 100
          : ((e.clientY - r.top) / r.height) * 100));
      }}
      onPointerUp={(e) => {
        setDragging(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 2;
        const back = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
        const fwd = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
        if (e.key === back) { e.preventDefault(); onChange(clamp(value - step)); }
        if (e.key === fwd) { e.preventDefault(); onChange(clamp(value + step)); }
        if (e.key === "Home") { e.preventDefault(); onChange(min); }
        if (e.key === "End") { e.preventDefault(); onChange(max); }
        if (e.key === "Enter") { e.preventDefault(); onReset?.(); }
      }}
      className={cn("shrink-0 touch-none bg-border transition-colors select-none hover:bg-foreground/30 focus-visible:bg-foreground/40 focus-visible:outline-none",
        orientation === "vertical" ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
        dragging && "bg-foreground/40", className)}
    />
  );
}
