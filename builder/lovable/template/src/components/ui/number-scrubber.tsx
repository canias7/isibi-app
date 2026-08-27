import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A number you drag sideways to change — the design-tool control.
 *
 * POINTER CAPTURE is what makes it work: without it the drag stops the moment
 * the cursor leaves the element, which is immediately, since the point is to
 * keep dragging past it.
 *
 * Shift is a coarse multiplier and Alt a fine one, which is the convention
 * every design tool shares. Arrow keys do the same job for anyone not using a
 * pointer — a scrubber without them is a control only a mouse can operate.
 */
export function NumberScrubber({ value, onChange, step = 1, min, max, label, suffix, className }: {
  value: number; onChange: (n: number) => void; step?: number;
  min?: number; max?: number; label?: string; suffix?: string; className?: string;
}) {
  const start = React.useRef<{ x: number; v: number } | null>(null);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const round = (n: number) => Math.round(n / step) * step;
  return (
    <span data-slot="number-scrubber"
      role="slider" tabIndex={0} aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      className={cn("inline-flex cursor-ew-resize select-none items-baseline gap-0.5 rounded px-1.5 py-0.5 text-sm tabular-nums hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40", className)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { x: e.clientX, v: value }; }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        onChange(clamp(round(start.current.v + (e.clientX - start.current.x) * step * mult)));
      }}
      onPointerUp={() => { start.current = null; }}
      onKeyDown={(e) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        onChange(clamp(round(value + d * step * (e.shiftKey ? 10 : 1))));
      }}>
      {label && <span className="me-1 text-xs text-muted-foreground">{label}</span>}
      {value}{suffix}
    </span>
  );
}
