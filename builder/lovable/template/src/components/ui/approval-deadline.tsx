import { cn, toDate } from "@/lib/utils";
/**
 * When an approval is due, and what happens if nobody acts.
 *
 * THE CONSEQUENCE IS THE POINT. "Due Friday" tells an approver nothing about
 * whether missing it matters — auto-approve and auto-reject are opposite
 * outcomes and both are common, so a deadline that does not say which is a
 * deadline nobody can prioritise against. Silence-means-yes in particular has
 * to be stated, because it is the one where doing nothing is a decision.
 *
 * OVERDUE IS SAID IN WORDS AND WEIGHT, not colour. A red date is invisible in
 * greyscale, and this is a component whose whole job is urgency.
 *
 * THE DATE IS A REAL `<time>` carrying its ISO value, so a calendar or a
 * crawler reads the machine form of the same day a person reads as "Fri 8 Aug".
 *
 * `daysLeft` is passed in rather than computed from a clock: the deadline
 * belongs to the server's day, not to whatever the visitor's device thinks it
 * is, and a component that disagrees with the backend about "overdue" is worse
 * than one that says nothing.
 */
export function ApprovalDeadline({ due, daysLeft, onExpiry = "nothing", className }: {
  /** ISO date. */
  due: string;
  /** Negative when overdue. Omit to show the date alone. */
  daysLeft?: number;
  onExpiry?: "nothing" | "approve" | "reject" | "escalate";
  className?: string;
}) {
  const d = toDate(due);
  const ok = !Number.isNaN(d.getTime());
  const over = daysLeft !== undefined && daysLeft < 0;
  const soon = daysLeft !== undefined && daysLeft >= 0 && daysLeft <= 1;
  const consequence = {
    nothing: "It will stay open until someone acts.",
    approve: "It will be approved automatically if nobody acts.",
    reject: "It will be rejected automatically if nobody acts.",
    escalate: "It will be passed up if nobody acts.",
  }[onExpiry];
  return (
    <p className={cn("text-sm", className)}>
      <span className={cn((over || soon) && "font-medium")}>
        {over ? "Overdue since " : "Due "}
        {ok ? (
          <time dateTime={d.toISOString().slice(0, 10)}>
            {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
          </time>
        ) : due}
      </span>
      {daysLeft !== undefined && !over && (
        <span className="text-muted-foreground"> · {daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `${daysLeft} days`}</span>
      )}
      <span className="block text-xs text-muted-foreground">{consequence}</span>
    </p>
  );
}
