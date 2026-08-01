import { cn } from "@/lib/utils";
/**
 * How well two sides fit — with the score's limits stated.
 *
 * A PERCENTAGE IMPLIES A PRECISION THE MODEL DOES NOT HAVE. 84% and 81% are
 * indistinguishable in every matching system ever built, and rendering them as
 * different numbers makes people choose on noise. Bands are honest; two decimal
 * places are not.
 *
 * IT SAYS WHAT THE SCORE CANNOT SEE. Chemistry, timing and everything nobody
 * wrote down are absent from every model, and a score presented without that
 * caveat gets treated as a measurement of compatibility rather than of stated
 * preferences.
 *
 * THE SCORE IS NEVER THE ONLY THING SHOWN. On its own it is a number to sort
 * by; beside the reasons it becomes something a person can disagree with, which
 * is the point.
 *
 * NO STARS. A five-star rating of a person invites comparison with a toaster,
 * and people notice.
 */
export function MatchScore({ score, bands = ["a weak fit", "a reasonable fit", "a strong fit"], basedOn, cannotSee = ["timing", "chemistry", "anything neither of you wrote down"], className }: {
  /** 0–1. Rendered as a band, not a percentage. */
  score: number;
  /** Lowest to highest. */
  bands?: string[];
  /** What the score was computed from. */
  basedOn?: string;
  /** What it does not account for. */
  cannotSee?: string[];
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(0.999, score));
  const band = bands[Math.floor(clamped * bands.length)] ?? bands[bands.length - 1];
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">Looks like {band}.</p>
      {basedOn && <p className="text-xs text-muted-foreground">Based on {basedOn}.</p>}
      {cannotSee.length > 0 && (
        <p className="text-xs text-muted-foreground">
          It cannot see {AND.format(cannotSee)} — so treat it as a shortlist, not a verdict.
        </p>
      )}
    </div>
  );
}
