import { cn } from "@/lib/utils";
/**
 * When we will try again, and when we stop.
 *
 * THE SCHEDULE IS SPELLED OUT AS TIMES, not as "exponential backoff with
 * jitter". The reader is deciding whether an outage on their side will be
 * survived, and "1 min, 5 min, 30 min, 2 h, 6 h — then we stop" answers that
 * exactly. The name of the algorithm answers nothing.
 *
 * THE TOTAL WINDOW IS STATED, because that is the real number: five attempts
 * over eight hours means a maintenance window at midnight is fine and a broken
 * deploy on Friday is not.
 *
 * WHAT HAPPENS AFTER THE LAST ATTEMPT IS PART OF THE POLICY. Kept in a dead
 * letter queue, or gone — those are different products, and an integrator plans
 * differently for each.
 *
 * AUTO-DISABLING IS DISCLOSED HERE. An endpoint being switched off after
 * repeated failure is the most surprising behaviour in any webhook system, and
 * it belongs beside the retry schedule rather than in a support article.
 */
export function RetryPolicy({ delays, totalWindow, afterLast = "dead-letter", disableAfter, className }: {
  /** In order — "1 minute", "5 minutes". */
  delays: string[];
  /** Free text — "about 8 hours". */
  totalWindow?: string;
  afterLast?: "dead-letter" | "dropped";
  /** Consecutive failures before the endpoint is switched off. */
  disableAfter?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <p>
        If your endpoint does not answer, we try again after{" "}
        <span className="text-foreground">{delays.join(", ")}</span>
        {totalWindow && <span> — {totalWindow} in all</span>}.
      </p>
      <p>
        {afterLast === "dead-letter"
          ? "After the last attempt the event is kept so you can send it again."
          : "After the last attempt the event is dropped and cannot be recovered."}
      </p>
      {disableAfter !== undefined && (
        <p>
          An endpoint that fails <span className="text-foreground">{disableAfter}</span> times in a row is switched off
          until you turn it back on.
        </p>
      )}
    </div>
  );
}
