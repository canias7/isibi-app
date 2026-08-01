import { cn } from "@/lib/utils";
/**
 * "Order by 14:00 for next-day delivery."
 *
 * THE PROMISE AND THE DEADLINE IN ONE SENTENCE. Split apart — a cutoff in the
 * shipping settings, a promise on the product page — they drift, and the
 * customer who ordered at 14:05 is the one who finds out.
 *
 * IT SAYS HOW LONG IS LEFT once the caller passes it, because "by 14:00" needs
 * the reader to know the time and do the subtraction, and "1 hour 12 minutes
 * left" is what actually converts.
 *
 * PASSED IS A DIFFERENT SENTENCE, not a hidden component. Vanishing after the
 * cutoff means the page silently stops mentioning delivery at all; saying "Too
 * late for today — order now for Thursday" keeps the promise honest and still
 * sells.
 *
 * The time is a real `<time>`; the countdown is the caller's, since only it
 * knows the timezone the cutoff is quoted in.
 */
export function CutoffTime({ by, promise, remaining, passed, nextPromise, className }: {
  /** The deadline as displayed — "14:00". */
  by: string;
  /** What making it buys — "next-day delivery". */
  promise: string;
  /** "1 hour 12 minutes" — computed by the caller. */
  remaining?: string;
  passed?: boolean;
  /** What is offered once it has gone — "Thursday delivery". */
  nextPromise?: string;
  className?: string;
}) {
  if (passed) {
    return (
      <p role="status" className={cn("text-sm", className)}>
        <span className="font-medium">Too late for {promise} today.</span>
        {nextPromise ? <span className="text-muted-foreground"> Order now for {nextPromise}.</span> : null}
      </p>
    );
  }
  return (
    <p role="status" className={cn("text-sm", className)}>
      <span className="font-medium">Order by <time>{by}</time> for {promise}</span>
      {remaining ? <span className="text-muted-foreground"> — {remaining} left</span> : null}
    </p>
  );
}
