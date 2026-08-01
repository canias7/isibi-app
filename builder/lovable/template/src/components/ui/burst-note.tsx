import { cn } from "@/lib/utils";
/**
 * A rate limit with a burst allowance, explained as a bucket.
 *
 * TWO NUMBERS, AND THE SECOND IS THE ONE THAT CONFUSES PEOPLE. "60 requests a
 * minute" with a burst of 100 means a client can send 100 at once and then must
 * slow to 60 a minute — so somebody testing with a loop of 80 sees it work and
 * concludes the documented limit is wrong. Saying both, with the refill rate,
 * removes an entire class of support question.
 *
 * IT SAYS HOW LONG A DRAINED BUCKET TAKES TO REFILL. That is the actionable
 * number for anybody writing a retry: "wait about 40 seconds" is a
 * `setTimeout`, where "you have been rate limited" is a guess.
 *
 * THE CURRENT LEVEL IS OPTIONAL. On a settings page this is documentation; on a
 * live dashboard it is a gauge, and the same component should serve both
 * without a second one existing.
 *
 * SEGMENTS AND A NUMBER, not a smooth bar — a bucket holds a countable number
 * of tokens and drawing it as a continuous fill implies a precision it has not
 * got.
 */
export function BurstNote({ sustained, per = "minute", burst, remaining, refillSeconds, className }: {
  /** Steady rate allowed. */
  sustained: number;
  /** The window that rate is over. */
  per?: string;
  /** How many can go at once. */
  burst: number;
  /** Tokens left right now, on a live view. */
  remaining?: number;
  /** Seconds to refill from empty. */
  refillSeconds?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium tabular-nums">{sustained.toLocaleString()}</span> a {per}
        <span className="text-muted-foreground">
          , or up to <span className="tabular-nums text-foreground">{burst.toLocaleString()}</span> at once
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        Send a burst and you must then slow to {sustained.toLocaleString()} a {per} while it refills
        {refillSeconds !== undefined && <span> — about {refillSeconds} seconds from empty</span>}.
      </p>
      {remaining !== undefined && (
        <p className="text-xs">
          <span className="tabular-nums font-medium">{remaining.toLocaleString()}</span>
          <span className="text-muted-foreground"> of {burst.toLocaleString()} left right now</span>
        </p>
      )}
    </div>
  );
}
