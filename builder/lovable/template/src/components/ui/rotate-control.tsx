import { RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Turn a picture the right way up.
 *
 * NINETY DEGREES AT A TIME, both directions. A free-rotation slider is for
 * straightening a horizon and is a different tool; the overwhelmingly common
 * need is a photo that came off a phone sideways, and that is four presses at
 * most.
 *
 * THE CURRENT ANGLE IS STATED, so somebody who has pressed three times knows
 * where they are — and so that a screen reader gets a value rather than two
 * buttons whose effect is invisible.
 *
 * It wraps at 360 rather than counting up forever, because "rotated 720°" is a
 * number that makes an interface look broken.
 */
export function RotateControl({ degrees, onChange, className }: {
  /** 0, 90, 180 or 270. */
  degrees: number;
  onChange: (deg: number) => void;
  className?: string;
}) {
  const turn = (by: number) => onChange((((degrees + by) % 360) + 360) % 360);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button type="button" onClick={() => turn(-90)} aria-label="Rotate left"
        className="grid size-8 cursor-pointer place-items-center rounded border border-border hover:bg-muted">
        <RotateCcw aria-hidden className="size-3.5" />
      </button>
      <span role="status" className="text-xs text-muted-foreground tabular-nums">{degrees}°</span>
      <button type="button" onClick={() => turn(90)} aria-label="Rotate right"
        className="grid size-8 cursor-pointer place-items-center rounded border border-border hover:bg-muted">
        <RotateCw aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}
