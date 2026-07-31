import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Before and after, with a handle dragged between them.
 *
 * The handle is a real `role="slider"` with arrow keys. Every before/after
 * widget on the web is drag-only, so the comparison — which is the entire
 * content — is unavailable to anyone not using a mouse or a touchscreen.
 *
 * Both images are FULL SIZE and stacked; the top one is clipped. Resizing the
 * top image instead squashes it, so the two stop lining up and the comparison
 * becomes meaningless — the bug in most hand-rolled versions, and it only shows
 * on images that are not square.
 *
 * The labels sit at the OUTER edges, so the handle never covers them and they
 * do not swap sides as it moves.
 *
 * Both images need the same dimensions. Nothing here can enforce that, so it is
 * said plainly rather than silently producing a misaligned comparison.
 */
export function ImageCompare({
  before, after, beforeAlt = "Before", afterAlt = "After",
  beforeLabel = "Before", afterLabel = "After", initial = 50, className,
}: {
  before: string;
  after: string;
  beforeAlt?: string;
  afterAlt?: string;
  beforeLabel?: React.ReactNode;
  afterLabel?: React.ReactNode;
  initial?: number;
  className?: string;
}) {
  const [pct, setPct] = React.useState(Math.min(100, Math.max(0, initial)));
  const ref = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  const track = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setPct(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <div ref={ref}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); track(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) track(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      className={cn("relative touch-none overflow-hidden rounded-md select-none", className)}>
      <img src={before} alt={beforeAlt} draggable={false} className="block w-full" />
      <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
        <img src={after} alt="" draggable={false} className="block h-full w-full object-cover" />
      </div>
      <img src={after} alt={afterAlt} className="sr-only" />

      <span className="absolute top-2 left-2 rounded bg-foreground/80 px-1.5 py-0.5 text-[11px] font-medium text-background">
        {beforeLabel}
      </span>
      <span className="absolute top-2 right-2 rounded bg-foreground/80 px-1.5 py-0.5 text-[11px] font-medium text-background">
        {afterLabel}
      </span>

      <div
        role="slider"
        aria-label="Compare before and after"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
        aria-valuetext={`${Math.round(pct)} per cent after`}
        tabIndex={0}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          if (e.key === "ArrowLeft") { e.preventDefault(); setPct((p) => Math.max(0, p - step)); }
          if (e.key === "ArrowRight") { e.preventDefault(); setPct((p) => Math.min(100, p + step)); }
          if (e.key === "Home") { e.preventDefault(); setPct(0); }
          if (e.key === "End") { e.preventDefault(); setPct(100); }
        }}
        style={{ left: `${pct}%` }}
        className="absolute inset-y-0 -ml-4 flex w-8 cursor-col-resize items-center justify-center focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span aria-hidden className="h-full w-0.5 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
        <span aria-hidden className="absolute size-6 rounded-full border-2 border-background bg-foreground/70" />
      </div>
    </div>
  );
}
