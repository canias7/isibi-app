import { cn } from "@/lib/utils";
/**
 * How many people answered, out of how many were asked.
 *
 * THE DENOMINATOR IS WHAT MAKES A RESULT READABLE. "92% satisfied" from 12
 * replies out of 400 people asked is a very different claim from 12 out of 14,
 * and only the response rate distinguishes them — which is why it is the number
 * survey dashboards leave off.
 *
 * IT WARNS WHEN THE RATE IS TOO LOW TO CONCLUDE ANYTHING, in words rather than
 * by colouring the number. Non-response bias is not intuitive: the people who
 * reply are systematically the ones who felt strongly, so a low rate does not
 * merely mean less data, it means skewed data.
 *
 * IT DOES NOT COMPUTE A CONFIDENCE INTERVAL. That needs assumptions about the
 * population this component cannot make, and a spuriously precise ±4.2% is
 * worse than an honest sentence.
 *
 * `tabular-nums` and a real percentage, rounded — a response rate quoted to one
 * decimal place implies a precision the sample does not have.
 */
export function ResponseRate({ answered, asked, lowBelow = 20, className }: {
  answered: number;
  asked: number;
  /** Percentage below which the caution appears. */
  lowBelow?: number;
  className?: string;
}) {
  if (!asked || asked <= 0) return null;
  const pct = Math.round((answered / asked) * 100);
  return (
    <p className={cn("text-sm", className)}>
      <span className="tabular-nums font-medium">{answered.toLocaleString()}</span>
      <span className="text-muted-foreground"> of </span>
      <span className="tabular-nums">{asked.toLocaleString()}</span>
      <span className="text-muted-foreground"> replied · </span>
      <span className="tabular-nums">{pct}%</span>
      {pct < lowBelow && (
        <span className="block text-xs text-muted-foreground">
          Too few replies to draw much from — the people who answer tend to be the ones who felt strongly.
        </span>
      )}
    </p>
  );
}
