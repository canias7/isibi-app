import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "This is taking longer than usual" — shown only when it actually is.
 *
 * It appears on a THRESHOLD, not immediately. Under a second or two nobody
 * needs telling; past that, silence is what makes somebody press the button
 * again, which on a payment or a booking is the expensive kind of duplicate.
 *
 * It ESCALATES rather than repeating. At five seconds it reassures; at twenty
 * it says the work is still running and offers a way out. Those are different
 * messages and the second one is the one that stops a reload.
 *
 * It NEVER claims the thing has failed. It has not — that is the whole point of
 * this component, and a page that says "something went wrong" while a request
 * is still in flight causes a retry that duplicates it.
 *
 * `aria-live="polite"`, announced once per stage.
 */
export function TimeoutNote({
  waiting, slowAfter = 5000, stuckAfter = 20000, onCancel, slowMessage, stuckMessage, className,
}: {
  waiting: boolean;
  slowAfter?: number;
  stuckAfter?: number;
  onCancel?: () => void;
  slowMessage?: React.ReactNode;
  stuckMessage?: React.ReactNode;
  className?: string;
}) {
  const [stage, setStage] = React.useState<0 | 1 | 2>(0);

  React.useEffect(() => {
    if (!waiting) { setStage(0); return; }
    const a = setTimeout(() => setStage(1), slowAfter);
    const b = setTimeout(() => setStage(2), stuckAfter);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [waiting, slowAfter, stuckAfter]);

  if (!waiting || stage === 0) return null;

  return (
    <p role="status" aria-live="polite" className={cn("text-xs text-muted-foreground", className)}>
      {stage === 1
        ? (slowMessage ?? "This is taking longer than usual — still going.")
        : (stuckMessage ?? "Still working. Nothing has been lost; you can wait or try again.")}
      {stage === 2 && onCancel ? (
        <>
          {" "}
          <button type="button" onClick={onCancel}
            className="cursor-pointer font-medium text-foreground underline underline-offset-2">
            Stop waiting
          </button>
        </>
      ) : null}
    </p>
  );
}
