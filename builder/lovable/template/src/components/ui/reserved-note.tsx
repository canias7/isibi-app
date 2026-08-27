import { cn } from "@/lib/utils";
/**
 * "Held for you for 12 more minutes" — a reservation with its clock showing.
 *
 * THE EXPIRY IS THE COMPONENT. A basket that quietly releases stock after
 * fifteen minutes, without saying so, sends somebody back to a checkout where
 * the item has vanished — which is far worse than being told about the limit up
 * front. This is the one piece of information that turns a nasty surprise into
 * a decision.
 *
 * THE MINUTES ARE PASSED IN, not counted down here. A ticking timer on a
 * checkout is a pressure tactic, and worse, a client-side clock disagrees with
 * the server about the moment of release — so the page says 30 seconds left
 * when the hold has already gone.
 *
 * EXPIRED IS A DISTINCT STATE with what to do next. "Your hold has ended, the
 * items are still in your basket but no longer reserved" is honest; silently
 * showing nothing means somebody discovers it at payment.
 *
 * `role="status"` — this changes while somebody is on the page, and it is the
 * change they most need to hear about.
 */
export function ReservedNote({ minutesLeft, count, unit = "items", expired, action, className }: {
  /** Whole minutes remaining, from the server. */
  minutesLeft?: number;
  count?: number;
  unit?: string;
  expired?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const what = count !== undefined ? `${count.toLocaleString()} ${count === 1 ? unit.replace(/s$/, "") : unit}` : "These";
  return (
    <p data-slot="reserved-note" role="status" className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      {expired ? (
        <>
          <span className="font-medium">Your hold has ended</span>
          <span className="text-muted-foreground">
            {what} are still in your basket, but no longer reserved for you.
          </span>
        </>
      ) : (
        <>
          <span>
            {what} {count === 1 ? "is" : "are"} held for you
            {minutesLeft !== undefined && (
              <span className="font-medium">
                {" "}for {minutesLeft < 1 ? "less than a minute" : `${minutesLeft} more ${minutesLeft === 1 ? "minute" : "minutes"}`}
              </span>
            )}
          </span>
        </>
      )}
      {action}
    </p>
  );
}
