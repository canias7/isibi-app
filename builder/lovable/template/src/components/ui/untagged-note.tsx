import { cn } from "@/lib/utils";
/**
 * How many things have no tag at all, with a way to go and see them.
 *
 * UNTAGGED RECORDS ARE INVISIBLE TO EVERY TAG FILTER, which is what makes this
 * worth stating. Somebody builds views on tags, trusts them, and never learns
 * that 60 items are in none of them — the data looks complete because every
 * view is internally consistent.
 *
 * IT GOES QUIET WHEN THE NUMBER IS SMALL, because a permanent nag about three
 * untagged records is the reason people stop reading the line at all. `warnAt`
 * is the caller's, since what counts as a lot depends on the collection.
 *
 * THE SHARE IS SHOWN ALONGSIDE THE COUNT where a total is known. 60 untagged
 * out of 80 and out of 8,000 are completely different situations and the raw
 * count reads identically.
 *
 * A LINK, NOT A BULK-TAG BUTTON. Choosing tags for 60 mixed records is not
 * something to do from a status line, and a one-click "tag them all" is how
 * everything ends up under a meaningless catch-all.
 */
export function UntaggedNote({ count, total, action, warnAt = 1, className }: {
  count: number;
  total?: number;
  /** Usually a link to the filtered list. */
  action?: React.ReactNode;
  warnAt?: number;
  className?: string;
}) {
  if (count < warnAt || count <= 0) return null;
  const share = total && total > 0 ? Math.round((count / total) * 100) : null;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm", className)}>
      <span>
        <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
        {" "}
        {count === 1 ? "item has" : "items have"} no tags
        {share !== null && <span className="text-muted-foreground"> · {share}% of them</span>}
      </span>
      <span className="text-xs text-muted-foreground">They will not appear in any tag filter.</span>
      {action}
    </p>
  );
}
