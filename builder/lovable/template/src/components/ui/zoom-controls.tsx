import * as React from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Zoom in, zoom out, fit to screen — for a canvas or a document.
 *
 * THE STEPS ARE MULTIPLICATIVE, not additive. Adding 25% each press means the
 * jump from 25% to 50% doubles the size while 200% to 225% barely moves — so
 * the control feels coarse at the bottom and useless at the top. A ratio per
 * press feels the same everywhere, which is why every drawing tool does it.
 *
 * The percentage is a BUTTON that resets to 100%. That is the shortcut people
 * try first, and a label that only reports the number wastes the one control
 * everybody aims at.
 *
 * "Fit" is separate from 100%, because they are genuinely different answers —
 * one shows everything, the other shows true size — and a control offering only
 * one of them makes the other a manual hunt.
 *
 * The keyboard shortcuts use the SAME steps, so the buttons and the keys cannot
 * drift into different zoom ladders.
 */
export function zoomStep(current: number, direction: 1 | -1, min = 0.1, max = 8) {
  // A ratio per press, so a step feels the same at 25% and at 400%.
  const next = direction > 0 ? current * 1.25 : current / 1.25;
  return Math.min(max, Math.max(min, Math.round(next * 100) / 100));
}

export function ZoomControls({ value, onChange, onFit, min = 0.1, max = 8, className }: {
  value: number;
  onChange: (zoom: number) => void;
  onFit?: () => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const changeRef = React.useRef(onChange);
  changeRef.current = onChange;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); changeRef.current(zoomStep(value, 1, min, max)); }
      if (e.key === "-") { e.preventDefault(); changeRef.current(zoomStep(value, -1, min, max)); }
      if (e.key === "0") { e.preventDefault(); changeRef.current(1); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [value, min, max]);

  return (
    <div className={cn("inline-flex items-center rounded-md border border-border bg-background", className)}>
      <button type="button" onClick={() => onChange(zoomStep(value, -1, min, max))}
        disabled={value <= min} aria-label="Zoom out"
        className="cursor-pointer rounded-s-md p-1.5 hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
        <ZoomOut aria-hidden className="size-4" />
      </button>
      <button type="button" onClick={() => onChange(1)}
        aria-label={`Zoom: ${Math.round(value * 100)} per cent. Reset to 100 per cent.`}
        className="cursor-pointer border-x border-border px-2 py-1.5 text-xs tabular-nums hover:bg-muted">
        {Math.round(value * 100)}%
      </button>
      <button type="button" onClick={() => onChange(zoomStep(value, 1, min, max))}
        disabled={value >= max} aria-label="Zoom in"
        className="cursor-pointer p-1.5 hover:bg-muted disabled:pointer-events-none disabled:opacity-40">
        <ZoomIn aria-hidden className="size-4" />
      </button>
      {onFit ? (
        <button type="button" onClick={onFit} aria-label="Fit to the screen"
          className="cursor-pointer rounded-e-md border-s border-border p-1.5 hover:bg-muted">
          <Maximize2 aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
