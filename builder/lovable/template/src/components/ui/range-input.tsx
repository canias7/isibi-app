import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * A from-and-to pair — price, age, weight.
 *
 * It reports the crossed state (`from` above `to`) rather than silently
 * swapping them: a filter that reorders what somebody typed makes the next
 * thing they type feel broken. Saying so is enough; the caller decides
 * whether to block submission.
 */
export function RangeInput({ from, to, onFromChange, onToChange, id = "range", unit, min, max, className }: {
  from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void;
  id?: string; unit?: string; min?: number; max?: number; className?: string;
}) {
  const crossed = from !== "" && to !== "" && Number(from) > Number(to);
  return (
    <div data-slot="range-input" className={cn("space-y-1.5", className)}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-from`} className="text-xs text-muted-foreground">From</Label>
          <Input id={`${id}-from`} inputMode="decimal" value={from} min={min} max={max}
            aria-invalid={crossed} className="tabular-nums"
            onChange={(e) => onFromChange(e.target.value.replace(/[^0-9.]/g, ""))} />
        </div>
        <span className="pb-2 text-sm text-muted-foreground">–</span>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">To</Label>
          <Input id={`${id}-to`} inputMode="decimal" value={to} min={min} max={max}
            aria-invalid={crossed} className="tabular-nums"
            onChange={(e) => onToChange(e.target.value.replace(/[^0-9.]/g, ""))} />
        </div>
        {unit && <span className="pb-2 text-sm text-muted-foreground">{unit}</span>}
      </div>
      {crossed && <p role="alert" className="text-xs text-destructive">The first number is higher than the second.</p>}
    </div>
  );
}
