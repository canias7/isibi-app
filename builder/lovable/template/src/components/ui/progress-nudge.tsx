import { cn } from "@/lib/utils";
/**
 * "Two more and your site is ready."
 *
 * COUNTS DOWN TO A NAMED OUTCOME, not up to a percentage. "60% complete" is a
 * status; "two more and customers can book" is a reason to do the next one, and
 * the outcome is what makes it worth finishing.
 *
 * IT NAMES THE NEXT TASK. A nudge that says how many remain but not which one
 * makes the reader go and find the list, and most do not.
 *
 * FINISHED IS A PLAIN STATEMENT and then the component stops nudging. Continuing
 * to celebrate a completed checklist is how a dashboard fills with things nobody
 * reads.
 */
export function ProgressNudge({ remaining, outcome, next, doneNote = "All set.", className }: {
  remaining: number;
  /** What finishing unlocks — "customers can book". */
  outcome?: string;
  /** The next task, named. */
  next?: { label: string; href?: string; onClick?: () => void };
  doneNote?: string;
  className?: string;
}) {
  if (remaining <= 0) {
    return <p role="status" className={cn("text-sm font-medium", className)}>{doneNote}</p>;
  }
  return (
    <p role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-sm", className)}>
      <span className="font-medium tabular-nums">
        {remaining} more{outcome ? ` and ${outcome}` : ""}
      </span>
      {next && (
        next.href
          ? <a href={next.href} className="underline underline-offset-4">{next.label}</a>
          : <button type="button" onClick={next.onClick} className="cursor-pointer underline underline-offset-4">{next.label}</button>
      )}
    </p>
  );
}
