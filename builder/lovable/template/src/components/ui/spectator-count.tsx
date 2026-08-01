import { cn } from "@/lib/utils";
/**
 * How many are watching — with the delay that makes it a fair count.
 *
 * THE STREAM DELAY IS PART OF THE FACT. Spectators are behind by a minute or
 * more, so a count shown to a player mid-match describes an audience reacting
 * to something that already happened — and in a competitive setting the delay
 * is what stops spectators leaking information.
 *
 * PEAK AND NOW ARE DIFFERENT NUMBERS. "40,000 watching" as a peak and as a
 * current figure are wildly different claims, and reporting one as the other is
 * how viewer numbers become untrustworthy.
 *
 * IT ROUNDS LARGE FIGURES AND SAYS SO. A live count to the last person is
 * spurious precision that changes every second and invites people to watch the
 * number instead of the match.
 *
 * NO COUNT AT ALL IS SHOWN BELOW A FLOOR. "3 watching" is discouraging, exact,
 * and nobody's business — and hiding it below a threshold is kinder than
 * broadcasting it.
 */
export function SpectatorCount({ watching, peak, delaySeconds, floor = 10, className }: {
  watching: number;
  peak?: number;
  /** How far behind spectators are. */
  delaySeconds?: number;
  /** Below this the number is not shown. */
  floor?: number;
  className?: string;
}) {
  const round = (n: number) =>
    n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const fmtDelay = (s: number) => (s < 60 ? `${s} seconds` : `${Math.round(s / 60)} minutes`);
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {watching < floor ? (
        <p className="text-muted-foreground">A few people are watching.</p>
      ) : (
        <p className="tabular-nums">
          <span className="font-medium">{round(watching)}</span>
          <span className="text-muted-foreground"> watching now</span>
          {peak !== undefined && peak > watching && (
            <span className="text-muted-foreground"> · {round(peak)} at the peak</span>
          )}
        </p>
      )}
      {watching >= 1000 && (
        <p className="text-xs text-muted-foreground">Rounded — an exact live count changes every second.</p>
      )}
      {delaySeconds !== undefined && (
        <p className="text-xs text-muted-foreground">
          Spectators are {fmtDelay(delaySeconds)} behind, so they cannot see anything live.
        </p>
      )}
    </div>
  );
}
