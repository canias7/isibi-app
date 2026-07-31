import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Zoom into a photograph on hover, and on tap.
 *
 * TAP works, not only hover. The classic magnifier is `onMouseMove` and does
 * absolutely nothing on a phone, which is most of the traffic — so a pointer
 * press toggles the zoom and a second one leaves it, and the same handler
 * serves both because `pointer` events cover mouse, touch and pen.
 *
 * The zoom is done with `background-position` on a scaled copy rather than by
 * transforming the image, so nothing overflows the container and no second
 * floating panel has to be positioned against the viewport — which is where
 * every lens implementation ends up fighting scroll containers.
 *
 * It is NOT a substitute for a full-size view. A magnifier at 2.5× on a
 * thumbnail is showing enlarged thumbnail pixels; `zoomSrc` takes the larger
 * file so there is genuinely more detail to see.
 *
 * `prefers-reduced-motion` removes the transition but keeps the zoom. The
 * effect is the feature; the easing is not.
 */
export function ImageZoom({ src, zoomSrc, alt = "", scale = 2.5, className }: {
  src: string;
  zoomSrc?: string;
  alt?: string;
  scale?: number;
  className?: string;
}) {
  const [on, setOn] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 50, y: 50 });
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({
      x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)),
    });
  };
  return (
    <div
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setOn(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setOn(false); }}
      onPointerDown={(e) => { if (e.pointerType !== "mouse") { track(e); setOn((v) => !v); } }}
      onPointerMove={track}
      className={cn("relative overflow-hidden rounded-md bg-muted", on ? "cursor-zoom-out" : "cursor-zoom-in", className)}
    >
      <img src={src} alt={alt} className="block w-full" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-no-repeat transition-opacity motion-reduce:transition-none"
        style={{
          backgroundImage: `url(${JSON.stringify(zoomSrc ?? src).slice(1, -1)})`,
          backgroundSize: `${scale * 100}%`,
          backgroundPosition: `${pos.x}% ${pos.y}%`,
          opacity: on ? 1 : 0,
        }}
      />
      <span className="sr-only">{on ? "Zoomed in. Tap or move away to zoom out." : "Hover or tap to zoom."}</span>
    </div>
  );
}
