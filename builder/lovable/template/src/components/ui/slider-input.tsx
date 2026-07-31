import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * A slider with the number beside it, editable.
 *
 * The pairing is the point. A slider alone cannot be set precisely — try
 * hitting exactly 250 on a 0–1000 track — and a number alone gives no sense
 * of the range. Together each covers the other's failure, and the box is what
 * makes the control usable from a keyboard at all.
 */
export function SliderInput({ value, onChange, min = 0, max = 100, step = 1, label, unit, id = "slider", className }: {
  value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; label?: string; unit?: string;
  id?: string; className?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label htmlFor={`${id}-num`} className="text-sm">{label}</Label>}
      <div className="flex items-center gap-3">
        <Slider value={[value]} min={min} max={max} step={step} aria-label={label}
          className="min-w-0 flex-1" onValueChange={([n]) => onChange(n)} />
        <div className="flex shrink-0 items-center gap-1">
          <Input id={`${id}-num`} inputMode="decimal" value={String(value)}
            className="h-8 w-16 text-right tabular-nums"
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(clamp(n)); }} />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
