import { cn } from "@/lib/utils";
/**
 * A flagged interaction, written so it does not get clicked through.
 *
 * ALERT FATIGUE IS THE DESIGN PROBLEM, not the alert. A system that fires on
 * every theoretical interaction trains people to dismiss all of them, including
 * the one that mattered — so severity is shown by WEIGHT and the low-severity
 * ones are collapsed rather than shouting alongside the serious.
 *
 * IT SAYS WHAT COULD HAPPEN, IN WORDS. "Interaction: moderate" is not
 * information. "Both lower blood pressure — she may faint standing up" is
 * something a pharmacist can act on and a patient can watch for.
 *
 * OVERRIDING IS ALLOWED AND RECORDED, never blocked. Almost every one of these
 * is deliberate and already known to the prescriber; a hard block just means
 * the medicine is dispensed outside the system where nothing is recorded.
 *
 * NO CLINICAL DATABASE IS IMPLIED. Whatever the caller checks against, this
 * renders — the component holds no drug knowledge of its own and does not
 * pretend to.
 */
export function InteractionWarning({ between, consequence, severity = "moderate", advice, onOverride, overriddenBy, overrideReason, className }: {
  /** The two or more things that interact. */
  between: string[];
  /** What could actually happen, in plain words. */
  consequence?: string;
  severity?: "low" | "moderate" | "serious";
  /** What to do about it. */
  advice?: string;
  onOverride?: () => void;
  overriddenBy?: string;
  overrideReason?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const heavy = severity === "serious";
  return (
    <div
      className={cn(
        "space-y-1 rounded-md border p-3 text-sm",
        heavy ? "border-foreground" : "border-border",
        className,
      )}
    >
      <p className={cn(heavy ? "font-medium" : severity === "low" ? "text-muted-foreground" : "")}>
        {AND.format(between)}
      </p>
      {consequence ? (
        <p className={cn("text-xs", heavy ? "font-medium" : "text-muted-foreground")}>{consequence}</p>
      ) : (
        <p className="text-xs font-medium">
          No consequence recorded — a severity on its own is not something anybody can act on.
        </p>
      )}
      {advice && <p className="text-xs text-muted-foreground">{advice}</p>}
      {overriddenBy ? (
        <p className="text-xs text-muted-foreground">
          {/* The reason is a clause somebody typed and it usually ends in a stop
              already. Appending one unconditionally prints ".." on the commonest
              input the field takes. */}
          Overridden by {overriddenBy}
          {overrideReason ? ` — ${overrideReason.replace(/\s*[.!?]\s*$/, "")}` : ", no reason recorded"}.
        </p>
      ) : (
        onOverride && (
          <button
            type="button"
            onClick={onOverride}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            Dispense anyway, with a reason
          </button>
        )
      )}
    </div>
  );
}
