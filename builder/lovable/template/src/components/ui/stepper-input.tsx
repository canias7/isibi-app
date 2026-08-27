import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A number with a minus and a plus.
 *
 * The middle is a REAL INPUT, not a display. Setting a quantity to 40 by
 * pressing + thirty-nine times is the failure of every stepper that makes the
 * number read-only, and it is worst on exactly the touch devices steppers are
 * built for.
 *
 * Empty is allowed WHILE TYPING and only clamped on blur. Clamping on every
 * keystroke means somebody clearing the box to type "12" watches it snap to
 * the minimum after the "1".
 */
export function StepperInput({ value, onChange, min = 0, max, step = 1, label, id, className }: {
  value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; label?: string; id?: string; className?: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));
  const shown = draft ?? String(value);
  return (
    <div data-slot="stepper-input" className={cn("inline-flex items-center", className)}>
      <Button type="button" size="icon-sm" variant="outline" className="rounded-e-none"
        disabled={value <= min} onClick={() => onChange(clamp(value - step))}
        aria-label={label ? `Decrease ${label}` : "Decrease"}>
        <Minus className="size-4" />
      </Button>
      <Input id={id} inputMode="numeric" value={shown} aria-label={label}
        className="h-8 w-14 rounded-none border-x-0 text-center tabular-nums"
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.-]/g, ""))}
        onBlur={() => { if (draft != null) { const n = Number(draft); onChange(clamp(Number.isFinite(n) ? n : value)); setDraft(null); } }} />
      <Button type="button" size="icon-sm" variant="outline" className="rounded-s-none"
        disabled={max != null && value >= max} onClick={() => onChange(clamp(value + step))}
        aria-label={label ? `Increase ${label}` : "Increase"}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
