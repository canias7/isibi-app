import * as React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Magnify a picture and move around it — with buttons, not just gestures.
 *
 * PINCH AND SCROLL ARE NOT ENOUGH. A zoom that only responds to gestures is
 * unavailable to a keyboard user and awkward with a trackpad, and it is
 * precisely the feature somebody with low vision came for. Explicit controls are
 * the accessible route and cost three buttons.
 *
 * ZOOM IS CLAMPED AND RESET IS ALWAYS OFFERED. Getting lost at 8× magnification
 * with no way back is the classic failure — people reload the page to escape.
 *
 * The transform is applied to a wrapper rather than the image, so alt text,
 * selection and find-in-page behave normally; and `transform-origin` is the
 * centre so zooming does not throw the subject off the edge.
 */
export function ZoomPan({ src, alt, max = 4, className }: {
  src: string; alt: string;
  max?: number;
  className?: string;
}) {
  const [zoom, setZoom] = React.useState(1);
  const step = (by: number) => setZoom((z) => Math.min(Math.max(Number((z + by).toFixed(2)), 1), max));
  return (
    <div data-slot="zoom-pan" className={cn("flex flex-col gap-2", className)}>
      <div className="overflow-auto rounded-md border border-border">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
          <img src={src} alt={alt} className="block w-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => step(-0.5)} disabled={zoom <= 1} aria-label="Zoom out"
          className="grid size-8 cursor-pointer place-items-center rounded border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
          <Minus aria-hidden className="size-3.5" />
        </button>
        <span role="status" className="text-xs text-muted-foreground tabular-nums">{zoom}×</span>
        <button type="button" onClick={() => step(0.5)} disabled={zoom >= max} aria-label="Zoom in"
          className="grid size-8 cursor-pointer place-items-center rounded border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
          <Plus aria-hidden className="size-3.5" />
        </button>
        <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Reset zoom"
          className="grid size-8 cursor-pointer place-items-center rounded border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
          <RotateCcw aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
