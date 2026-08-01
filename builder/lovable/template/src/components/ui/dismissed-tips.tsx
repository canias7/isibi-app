import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Bring back the hints you turned off.
 *
 * DISMISSING SHOULD NOT BE PERMANENT AND UNDISCOVERABLE, which is what it
 * usually is. People close tips in their first minute to get on with it, and
 * then have no idea the help existed — this is the one control that makes that
 * recoverable.
 *
 * THE COUNT IS SHOWN, because "restore hints" with nothing hidden is a button
 * that appears to do nothing. It renders null at zero for the same reason.
 *
 * Deliberately lives in settings rather than following people around: the point
 * is that it can be found when wanted, not that it is offered again.
 */
export function DismissedTips({ count, onRestore, className }: {
  count: number;
  onRestore: () => void;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <p className="text-sm text-muted-foreground tabular-nums">
        {count} {count === 1 ? "hint" : "hints"} hidden
      </p>
      <Button size="sm" variant="outline" onClick={onRestore}>Show them again</Button>
    </div>
  );
}
