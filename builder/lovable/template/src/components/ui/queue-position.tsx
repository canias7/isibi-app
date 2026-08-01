import { cn } from "@/lib/utils";
/**
 * You are Nth in line.
 *
 * THE NUMBER MUST ONLY GO DOWN. A position that jumps backwards — because
 * somebody was prioritised, or the count was recomputed — destroys trust in the
 * whole queue instantly, and it is better to show a range or a wait than a
 * number that can rise.
 *
 * IT PAIRS THE POSITION WITH A WAIT where the caller has one, because "14th" is
 * meaningless without knowing whether the queue moves in minutes or days.
 *
 * NEXT IS ITS OWN SENTENCE rather than "1st", which reads oddly and is the one
 * position worth calling out plainly.
 */
export function QueuePosition({ position, of, wait, className }: {
  position: number;
  /** Total waiting, when it is known. */
  of?: number;
  /** "about 20 minutes" */
  wait?: string;
  className?: string;
}) {
  if (position <= 0) return null;
  return (
    <p role="status" className={cn("text-sm tabular-nums", className)}>
      <span className="font-medium">
        {position === 1 ? "You're next" : `You're ${position}${["th", "st", "nd", "rd"][(position % 100 >> 3 ^ 1) && position % 10 < 4 ? position % 10 : 0]} in the queue`}
      </span>
      <span className="text-muted-foreground">
        {typeof of === "number" ? ` of ${of}` : ""}
        {wait ? ` · about ${wait}` : ""}
      </span>
    </p>
  );
}
