import { cn } from "@/lib/utils";
/**
 * What the ends of a rating scale actually mean, before somebody picks.
 *
 * A SCALE WITHOUT ANCHORS IS NOT A SCALE. "Rate us 1 to 5" gets answered
 * against whatever each person imagines 5 means — some reserve it for
 * perfection, others give it for "no complaints" — so the average is a mixture
 * of incompatible scales. Naming both ends is what makes the numbers
 * comparable.
 *
 * IT SAYS WHO SEES THE ANSWER AND WHAT IT AFFECTS. People rate very differently
 * when a score is public beside a person's name than when it goes to a manager,
 * and being honest about it produces better data than pretending it is
 * anonymous when it is not.
 *
 * IT IS DELIBERATELY NOT A TOOLTIP. This has to be read BEFORE choosing, and a
 * hover card is discovered afterwards or never — especially on a phone, where
 * hover does not exist.
 *
 * `low` AND `high` ARE PROSE, not adjectives to be styled — the caller writes
 * the sentences because what 1 and 5 mean is a product decision.
 */
export function RatingGuidance({ low, high, visibility, affects, className }: {
  /** What the bottom of the scale means. */
  low: string;
  /** What the top means. */
  high: string;
  /** Who sees it — "your barber sees this with your name". */
  visibility?: string;
  /** What it is used for — "it decides who appears first in search". */
  affects?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <p>
        <span className="text-foreground">Lowest</span> means {low}.{" "}
        <span className="text-foreground">Highest</span> means {high}.
      </p>
      {visibility && <p>{visibility}</p>}
      {affects && <p>{affects}</p>}
    </div>
  );
}
