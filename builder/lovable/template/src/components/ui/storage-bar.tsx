import { FileSize } from "@/components/ui/file-size";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
/** How much space is used, in real units rather than a bare percentage. */
export function StorageBar({ used, total, label = "Storage", warnAt = 0.85, className }: {
  used: number; total: number; label?: string; warnAt?: number; className?: string;
}) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const tone = pct >= 100 ? "text-destructive" : pct >= warnAt * 100 ? "text-warning" : "text-muted-foreground";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className={cn("tabular-nums", tone)}>
          <FileSize bytes={used} /> of <FileSize bytes={total} />
        </span>
      </div>
      <Progress value={pct} aria-label={`${label}: ${Math.round(pct)}% used`} />
    </div>
  );
}
