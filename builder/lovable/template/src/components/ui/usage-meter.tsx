import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
/**
 * How much of an allowance is gone.
 *
 * Turns warning near the cap and destructive at it, and says the numbers as well
 * as drawing them — a bar alone does not tell anyone how much is left.
 *
 * THE NUMBERS ARE FORMATTED, never interpolated raw. An allowance is exactly
 * where six-figure numbers live, and this printed "168400 events of 250000
 * events" on a real page while its own sibling `token-meter` had been getting
 * it right all along. `toLocaleString` is a no-op on a small number, so there
 * is no case where the raw form was the better one.
 */
export function UsageMeter({ label, used, total, unit = "", warnAt = 0.8, className }: {
  label: string; used: number; total: number; unit?: string;
  warnAt?: number; className?: string;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const tone = pct >= 100 ? "text-destructive" : pct >= warnAt * 100 ? "text-warning" : "text-muted-foreground";
  return (
    <div data-slot="usage-meter" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className={cn("tabular-nums", tone)}>
          {used.toLocaleString()}{unit} of {total.toLocaleString()}{unit}
        </span>
      </div>
      <Progress value={pct} aria-label={`${label}: ${Math.round(pct)}% used`} />
    </div>
  );
}
