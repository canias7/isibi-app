import { cn } from "@/lib/utils";
/**
 * When it should arrive — as a window, not a moment.
 *
 * A SINGLE TIME IS HEARD AS A PROMISE. "Arriving 14:20" produces a complaint at
 * 14:21; "between 14:00 and 15:00" sets an expectation that can be held, and it
 * is what every delivery service converged on for good reason.
 *
 * THE WINDOW NARROWS RATHER THAN MOVING. `confidence` says how firm it is, so an
 * early four-hour window and a final thirty-minute one are visibly different
 * claims rather than looking like the estimate changed.
 *
 * LATE IS STATED PLAINLY once the window has passed. Silently keeping a stale
 * window on screen is what makes people ring, and admitting it is late is what
 * stops them.
 */
export function EtaBand({ from, to, confidence, late, className }: {
  /** Display strings — "14:00". */
  from: string;
  to: string;
  /** How firm — "narrowing as it gets closer". */
  confidence?: string;
  /** True once the window has passed. */
  late?: boolean;
  className?: string;
}) {
  return (
    <p role="status" className={cn("text-sm", className)}>
      <span className={cn("tabular-nums", late ? "text-muted-foreground line-through" : "font-medium")}>
        Between {from} and {to}
      </span>
      {late && <span className="font-medium"> — running late</span>}
      {!late && confidence && <span className="text-muted-foreground"> · {confidence}</span>}
    </p>
  );
}
