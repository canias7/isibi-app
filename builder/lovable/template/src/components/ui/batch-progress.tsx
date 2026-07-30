import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "312 of 1,204."
 *
 * Counts, not just a percentage: a bar at 26% says nothing about whether
 * there are four items left or four thousand, and a long job needs the
 * difference.
 *
 * Stop rather than Cancel. A batch part-way through has already written
 * something and "cancel" implies it will be undone — stopping is what
 * actually happens, and saying so is what stops somebody expecting a rollback
 * that is not coming.
 */
export function BatchProgress({ done, total, label, failed = 0, onStop, className }: {
  done: number; total: number; label?: string; failed?: number;
  onStop?: () => void; className?: string;
}) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const running = done < total;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm">
          {label && <span className="mr-2 text-muted-foreground">{label}</span>}
          <strong className="tabular-nums">{done.toLocaleString()}</strong>
          <span className="text-muted-foreground"> of {total.toLocaleString()}</span>
        </p>
        {onStop && running && <Button size="sm" variant="ghost" onClick={onStop}>Stop</Button>}
      </div>
      <Progress value={pct} className="h-1.5" />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {running ? `${Math.round(pct)}% done` : "Finished"}
        {failed > 0 && <span className="text-destructive"> · {failed.toLocaleString()} failed</span>}
      </p>
    </div>
  );
}
