import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A grid whose columns the reader can drag — the layout counterpart to
 * `column-resize`, which does one table header.
 *
 * IT USES `grid-template-columns` FROM A CUSTOM PROPERTY, not a class name.
 * A width computed at runtime cannot go into a Tailwind class: the scanner
 * reads source as text, so `grid-cols-[${n}px]` is never emitted and the rule
 * silently does nothing. That failure typechecks and bundles, which is why it
 * is worth naming.
 *
 * Widths are stored in `fr` UNITS so the layout still fills its container at
 * any size. Pixel widths look right at the size they were set and leave a gap
 * or overflow at every other, which is what makes hand-rolled resizable grids
 * break on a laptop.
 *
 * Each column has a MINIMUM, enforced against its neighbour, so a column cannot
 * be dragged to zero and lose its own handle. Same rule as `column-resize` and
 * `panel-group`.
 *
 * Below `md` it becomes ONE column and the handles disappear — a three-column
 * grid on a phone is not a layout worth preserving.
 */
export function ResizableColumns({ columns, widths, onWidths, min = 0.2, className }: {
  columns: { key: string; label?: string; content: React.ReactNode }[];
  widths: number[];
  onWidths: (next: number[]) => void;
  min?: number;
  className?: string;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ i: number; x: number; a: number; b: number } | null>(null);

  const template = widths.map((w) => `${w}fr`).join(" var(--handle) ");

  const move = (clientX: number) => {
    const d = drag.current;
    const el = wrap.current;
    if (!d || !el) return;
    const per = el.clientWidth / widths.reduce((n, w) => n + w, 0);
    const delta = (clientX - d.x) / Math.max(1, per);
    const total = d.a + d.b;
    const a = Math.max(min, Math.min(total - min, d.a + delta));
    const next = widths.slice();
    next[d.i] = a;
    next[d.i + 1] = total - a;
    onWidths(next);
  };

  return (
    <div data-slot="resizable-columns"
      ref={wrap}
      // A runtime width has to go through a custom property; a class name built
      // at runtime is never emitted by the scanner.
      style={{ ["--handle" as string]: "6px", gridTemplateColumns: template }}
      className={cn("grid grid-cols-1 md:grid", className)}
    >
      {columns.map((c, i) => (
        <React.Fragment key={c.key}>
          <div className="min-w-0 overflow-auto" role="group" aria-label={c.label}>{c.content}</div>
          {i < columns.length - 1 ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={`Resize ${c.label ?? `column ${i + 1}`}`}
              tabIndex={0}
              onPointerDown={(e) => {
                drag.current = { i, x: e.clientX, a: widths[i], b: widths[i + 1] };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => { if (drag.current) move(e.clientX); }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 0.2 : 0.05;
                const total = widths[i] + widths[i + 1];
                const shift = (d: number) => {
                  const a = Math.max(min, Math.min(total - min, widths[i] + d));
                  const next = widths.slice();
                  next[i] = a;
                  next[i + 1] = total - a;
                  onWidths(next);
                };
                if (e.key === "ArrowLeft") { e.preventDefault(); shift(-step); }
                if (e.key === "ArrowRight") { e.preventDefault(); shift(step); }
              }}
              className="hidden cursor-col-resize touch-none bg-border hover:bg-foreground/30 focus-visible:bg-foreground/40 focus-visible:outline-none md:block"
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}
