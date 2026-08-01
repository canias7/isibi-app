import { cn } from "@/lib/utils";
/**
 * What the meter is sending, how often, and what that means for the customer.
 *
 * READING FREQUENCY IS A PRIVACY SETTING AND IS PRESENTED AS ONE. Half-hourly
 * data says when a household is in, asleep or away; monthly data says almost
 * nothing. Framing it as a technical detail hides the actual decision, and the
 * component states the consequence in plain words.
 *
 * A METER IN "DUMB MODE" IS THE ORDINARY FAILURE AND IS NAMED. It happens after
 * a switch or where the signal is poor, and the visible symptom is estimated
 * bills — which the customer reads as a billing error rather than a meter that
 * stopped communicating.
 *
 * THE IN-HOME DISPLAY IS SEPARATE FROM THE METER. A blank display is not a
 * broken meter; readings still reach the supplier. Conflating them produces an
 * engineer visit that was never needed.
 *
 * IT SAYS WHEN THE LAST READING ACTUALLY ARRIVED, which is how anybody can tell
 * whether any of the above is true right now.
 */
export function SmartMeterNote({ sending = true, frequency = "daily", lastReadingAt, displayWorking, canChangeFrequency = true, className }: {
  /** False when the meter has fallen back to manual reads. */
  sending?: boolean;
  frequency?: "half-hourly" | "daily" | "monthly";
  /** Free text — "today at 06:12". */
  lastReadingAt?: string;
  displayWorking?: boolean;
  canChangeFrequency?: boolean;
  className?: string;
}) {
  const MEANS = {
    "half-hourly": "shows when you are in, asleep or away",
    daily: "shows how much you used each day, not when",
    monthly: "shows a monthly total and nothing about your day",
  }[frequency];
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(!sending && "font-medium")}>
        {sending ? `Sending readings ${frequency}` : "Not sending readings"}
      </p>
      {sending ? (
        <p className="text-xs text-muted-foreground">
          {frequency.charAt(0).toUpperCase() + frequency.slice(1)} data {MEANS}.
          {canChangeFrequency && " You can change this at any time."}
        </p>
      ) : (
        <p className="text-xs">
          Your bills are being estimated until it reconnects. Sending us a reading yourself will correct them.
        </p>
      )}
      {lastReadingAt && (
        <p className="text-xs text-muted-foreground">Last reading received {lastReadingAt}.</p>
      )}
      {displayWorking === false && (
        <p className="text-xs text-muted-foreground">
          The in-home display is not working. That is separate from the meter — your readings are unaffected.
        </p>
      )}
    </div>
  );
}
