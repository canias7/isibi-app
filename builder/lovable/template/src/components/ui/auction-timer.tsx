import { cn } from "@/lib/utils";
/**
 * Time left on a lot — with the extension rule, which decides everything.
 *
 * ANTI-SNIPE EXTENSION IS THE RULE THAT MATTERS AND IS ALMOST NEVER SHOWN. If a
 * bid in the last two minutes extends the lot, then "closes at 14:00" is false
 * and the whole sniping strategy is pointless — telling people converts a race
 * into an auction.
 *
 * THE CLOSING TIME IS ABSOLUTE AND IS SHOWN ALONGSIDE THE COUNTDOWN. A
 * countdown alone is unusable to somebody planning their afternoon, and a
 * mis-set clock makes it wrong in a way nobody can detect.
 *
 * IT COUNTS IN MINUTES UNTIL THE LAST FEW. Second-by-second counters on a
 * multi-day auction are pure anxiety, and they are the standard pattern.
 *
 * IT SAYS WHAT HAPPENS AT ZERO. Whether a lot closes hard, extends, or waits
 * for a live auctioneer is different at every house, and it is the question
 * everybody has at 30 seconds.
 */
export function AuctionTimer({ secondsLeft, closesAt, extendsBySeconds, extendIfBidWithinSeconds, extended, atZeroNote, className }: {
  secondsLeft: number;
  /** Free text absolute time — "14:00 on 16 August". */
  closesAt?: string;
  /** How much a late bid adds. */
  extendsBySeconds?: number;
  /** A bid inside this window triggers an extension. */
  extendIfBidWithinSeconds?: number;
  /** True where it has already been extended. */
  extended?: boolean;
  atZeroNote?: string;
  className?: string;
}) {
  const fmt = (s: number) => {
    if (s <= 0) return "closed";
    if (s < 120) return `${s} seconds`;
    const m = Math.floor(s / 60);
    if (m < 90) return `${m} minutes`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h} hours`;
    return `${Math.floor(h / 24)} days`;
  };
  const inWindow =
    extendIfBidWithinSeconds !== undefined && secondsLeft <= extendIfBidWithinSeconds && secondsLeft > 0;
  return (
    <div data-slot="auction-timer" className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn("tabular-nums", secondsLeft < 300 && "font-medium")}>
        {secondsLeft <= 0 ? "Closed." : `${fmt(secondsLeft)} left.`}
      </p>
      {closesAt && (
        <p className="text-xs tabular-nums text-muted-foreground">Scheduled to close at {closesAt}.</p>
      )}
      {extendIfBidWithinSeconds !== undefined && extendsBySeconds !== undefined && (
        <p className={cn("text-xs", inWindow ? "font-medium" : "text-muted-foreground")}>
          A bid in the last {fmt(extendIfBidWithinSeconds)} adds another {fmt(extendsBySeconds)}
          {inWindow ? " — so a last-second bid will not win it" : ""}.
        </p>
      )}
      {extended && (
        <p className="text-xs text-muted-foreground">This lot has already been extended by late bidding.</p>
      )}
      {atZeroNote && <p className="text-xs">{atZeroNote}</p>}
    </div>
  );
}
