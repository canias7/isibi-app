import { cn } from "@/lib/utils";
/**
 * How many attempts are left before it stops trying.
 *
 * A thing that has been retrying silently for ten minutes looks identical to a
 * thing that has given up. This says which, and says what happens at the end —
 * because "3 of 5 attempts used" without a consequence is trivia, and "after
 * that it stops and waits for you" is a plan.
 *
 * THE LAST ATTEMPT IS CALLED OUT IN WORDS. Somebody watching a counter tick
 * down needs to know the moment their input is about to be required, and
 * "1 attempt left" buried in a row of numbers is not that moment.
 *
 * The pips are `aria-hidden`; the sentence beside them is what gets read. Same
 * discipline as `connection-quality` — shape carries nothing on its own.
 */
export function RetryBudget({ used, total, exhaustedNote, className }: {
  used: number;
  total: number;
  /** What happens when they run out. */
  exhaustedNote?: string;
  className?: string;
}) {
  if (total <= 0) return null;
  const left = Math.max(total - used, 0);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="inline-flex gap-1">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn("size-1.5 rounded-full", i < used ? "bg-muted" : "bg-foreground")} />
          ))}
        </span>
        <span role="status" className={cn("text-sm tabular-nums", left <= 1 ? "font-medium" : "text-muted-foreground")}>
          {left === 0 ? "No attempts left"
            : left === 1 ? "Last attempt"
            : `${left} of ${total} attempts left`}
        </span>
      </div>
      {exhaustedNote && left <= 1 && (
        <p className="text-xs text-muted-foreground">{exhaustedNote}</p>
      )}
    </div>
  );
}
