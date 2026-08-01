import { cn } from "@/lib/utils";
/**
 * The crop rectangle drawn over an image.
 *
 * PURELY THE OVERLAY. The pointer maths belongs to the caller, because a crop
 * that respects an aspect ratio, snaps to a grid or clamps to the image differs
 * per use — and a component guessing at that is wrong on every editor it did not
 * design.
 *
 * THE AREA OUTSIDE IS DIMMED, not the area inside highlighted. Dimming the
 * surround is what makes the kept region readable at a glance; a border alone
 * leaves the eye unsure which side is being kept, which is the one thing this
 * has to communicate.
 *
 * The handles are `aria-hidden` and the caller is expected to offer numeric
 * inputs beside it — a drag-only crop is unusable by keyboard, and no amount of
 * ARIA on a rectangle fixes that.
 */
export function CropBox({ rect, className }: {
  /** Percentages of the image — { x, y, w, h }, each 0-100. */
  rect: { x: number; y: number; w: number; h: number };
  className?: string;
}) {
  const clamp = (n: number) => Math.min(Math.max(n, 0), 100);
  const x = clamp(rect.x), y = clamp(rect.y);
  const w = clamp(rect.w), h = clamp(rect.h);
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div className="absolute inset-0 bg-background/60"
        style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${y}%, ${x}% ${y}%, ${x}% ${y + h}%, ${x + w}% ${y + h}%, ${x + w}% ${y}%, 0 ${y}%)` }} />
      <div className="absolute border-2 border-background outline outline-foreground"
        style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}>
        {[["-top-1 -left-1"], ["-top-1 -right-1"], ["-bottom-1 -left-1"], ["-bottom-1 -right-1"]].map(([pos], i) => (
          <span key={i} className={cn("absolute size-2 rounded-xs border border-background bg-foreground", pos)} />
        ))}
      </div>
    </div>
  );
}
