import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
/**
 * "Pinch to zoom" — with buttons that do the same thing.
 *
 * THE BUTTONS ARE THE POINT, NOT THE HINT. Pinch needs two working fingers on
 * one hand and cannot be done with a keyboard, a switch, or one hand holding a
 * phone on a train. Any surface where zooming matters — a plan, a scan, a chart
 * — needs controls, and this pairs the hint with them.
 *
 * THE CURRENT ZOOM IS PRINTED. On a document somebody is measuring or reading
 * fine print from, "140%" is information; a view with no stated scale is one
 * where nobody knows whether they are seeing detail or an artefact.
 *
 * RESET IS A SEPARATE CONTROL, because getting back to a known state after
 * zooming into a corner is otherwise a fiddle — and on a touchscreen it is
 * several.
 *
 * THE GESTURE HINT IS COARSE-POINTER ONLY AND `aria-hidden`; the buttons are
 * always there for everybody.
 */
export function PinchHint({ zoom, onZoom, min = 0.5, max = 4, step = 0.25, className }: {
  /** 1 is actual size. */
  zoom: number;
  onZoom: (z: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const clamp = (z: number) => Math.max(min, Math.min(max, Math.round(z * 100) / 100));
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Zoom out" disabled={zoom <= min}
          onClick={() => onZoom(clamp(zoom - step))}
          className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm disabled:opacity-50">
          −
        </button>
        <span aria-live="polite" className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={zoom >= max}
          onClick={() => onZoom(clamp(zoom + step))}
          className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm disabled:opacity-50">
          +
        </button>
        {zoom !== 1 && (
          <button type="button" onClick={() => onZoom(1)} className="text-xs underline underline-offset-2">
            Actual size
          </button>
        )}
      </div>
      {touch && (
        <p aria-hidden="true" className="text-xs text-muted-foreground">Or pinch to zoom.</p>
      )}
    </div>
  );
}
