import { cn } from "@/lib/utils";
/**
 * A sampling rate, with what it does to the numbers stated.
 *
 * SAMPLED DATA IS SCALED UP AND THAT IS WHERE PEOPLE GET FOOLED. At 10%, a
 * count of 40 events is reported as 400 — fine for a busy funnel, meaningless
 * for a rare one, where the true figure could be 300 or 500. The rarer the
 * event, the worse the estimate, and nothing on a dashboard says so.
 *
 * IT NAMES THE FLOOR BELOW WHICH NOT TO TRUST IT. "Under about 100 observed
 * events, treat this as a hint" is a rule somebody can apply while reading, and
 * it converts a general unease into a usable threshold.
 *
 * ERRORS AND RARE EVENTS ARE CALLED OUT SEPARATELY. Sampling an error stream is
 * the specific mistake that hides an incident affecting a handful of customers
 * — exactly the ones who ring up.
 *
 * IT SAYS WHETHER SAMPLING IS DETERMINISTIC PER USER. Sampling per event breaks
 * funnels — a visitor can be in for step one and out for step two, so a
 * conversion rate computed from it is simply wrong.
 */
export function SampleRate({ percent, observed, perUser, trustAbove = 100, className }: {
  /** 100 means everything is kept. */
  percent: number;
  /** How many events were actually recorded. */
  observed?: number;
  /** True when the same visitor is consistently in or out. */
  perUser?: boolean;
  /** Below this many observed events, say not to trust it. */
  trustAbove?: number;
  className?: string;
}) {
  if (percent >= 100) return null;
  const thin = observed !== undefined && observed < trustAbove;
  return (
    <p className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <span className="block">
        <span className="text-foreground tabular-nums">{percent}%</span> of events are kept and the numbers scaled back
        up{observed !== undefined && <> — <span className="tabular-nums text-foreground">{observed.toLocaleString()}</span> actually recorded</>}.
      </span>
      {thin && (
        <span className="block font-medium text-foreground">
          Too few to be reliable — treat anything below {trustAbove.toLocaleString()} observed events as a hint.
        </span>
      )}
      <span className="block">
        {perUser
          ? "The same visitor is always in or out, so funnels hold together."
          : "Sampling is per event, so a visitor can be counted at one step and not the next — funnels from this are unreliable."}
      </span>
    </p>
  );
}
