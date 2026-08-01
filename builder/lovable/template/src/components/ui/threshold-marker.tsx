import { cn } from "@/lib/utils";
/**
 * The line a number must not cross, drawn on the scale it belongs to.
 *
 * DASHED AND LABELLED, never a coloured zone. The kit's chart library learned
 * this the expensive way: every reference line in it was `bg-destructive`, which
 * meant nothing, vanished in greyscale, and was invisible to a large minority of
 * readers. A dashed line plus a written label survives all three.
 *
 * The label sits ON the scale rather than in a legend, because a legend forces
 * the reader to look away from the thing being measured and back again.
 *
 * `side` flips the label when the marker is near the end of the track, so it
 * cannot be clipped by the container — the one layout bug this shape always has.
 */
export function ThresholdMarker({ at, min, max, label, side = "auto", className }: {
  /** The threshold value. */
  at: number;
  min: number; max: number;
  label: string;
  side?: "left" | "right" | "auto";
  className?: string;
}) {
  const span = max - min;
  if (span <= 0) return null;
  const pct = Math.min(Math.max(((at - min) / span) * 100, 0), 100);
  const flip = side === "auto" ? pct > 70 : side === "left";
  return (
    <div className={cn("pointer-events-none absolute inset-y-0", className)} style={{ left: `${pct}%` }}>
      <div aria-hidden className="h-full border-l border-dashed border-foreground" />
      <span className={cn("absolute top-0 whitespace-nowrap text-[10px] text-muted-foreground",
        flip ? "right-1" : "left-1")}>
        {label}
      </span>
    </div>
  );
}
