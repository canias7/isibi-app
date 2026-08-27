import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "Too many attempts — try again in 40 seconds."
 *
 * It counts DOWN and re-enables itself. A limit notice with no timer and no
 * recovery is indistinguishable from a permanent block, so people reload
 * repeatedly and extend the very window they are waiting on.
 */
export function RateLimited({ seconds, onRetry, message, className }: {
  seconds: number; onRetry?: () => void; message?: string; className?: string;
}) {
  const [left, setLeft] = React.useState(Math.max(0, Math.round(seconds)));
  React.useEffect(() => { setLeft(Math.max(0, Math.round(seconds))); }, [seconds]);
  React.useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [left > 0]);
  const text = left >= 60 ? `${Math.floor(left / 60)} min ${left % 60}s` : `${left}s`;
  return (
    <div data-slot="rate-limited" role="alert" className={cn("space-y-3 rounded-lg border border-border px-6 py-8 text-center", className)}>
      <p className="text-sm font-medium">{message ?? "Too many attempts"}</p>
      <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {left > 0 ? <>You can try again in {text}.</> : "You can try again now."}
      </p>
      {onRetry && <Button variant="outline" disabled={left > 0} onClick={onRetry}>Try again</Button>}
    </div>
  );
}
