import { cn } from "@/lib/utils";
/**
 * How many people are watching this.
 *
 * IT SAYS WHETHER *YOU* ARE ONE OF THEM. "12 watching" leaves the reader
 * wondering whether they are counted, which is the only part they can act on —
 * and getting it wrong means either missing updates or being surprised by them.
 *
 * NOT A LIVE PRESENCE COUNT. This is how many have subscribed, which is stable;
 * a figure that ticks up and down as people open the page is `presence-dots`,
 * and conflating the two makes a subscription count look broken.
 *
 * Renders nothing at zero rather than "0 watching", which reads as a judgement
 * on the thing rather than a neutral fact.
 */
export function WatchCount({ count, youAreWatching, className }: {
  count: number;
  youAreWatching?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span data-slot="watch-count" className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      {count} watching{youAreWatching ? ", including you" : ""}
    </span>
  );
}
