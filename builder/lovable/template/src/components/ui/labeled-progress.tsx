import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
/** A bar that says what it is and how far along. */
export function LabeledProgress({ label, value, total, unit = "", className }: {
  label: string; value: number; total?: number; unit?: string; className?: string;
}) {
  const pct = total ? Math.min(100, (value / total) * 100) : Math.min(100, value);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {total ? `${value}${unit} / ${total}${unit}` : `${Math.round(pct)}%`}
        </span>
      </div>
      <Progress value={pct} aria-label={`${label}: ${Math.round(pct)}%`} />
    </div>
  );
}
