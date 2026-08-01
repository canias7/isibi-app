import { cn } from "@/lib/utils";
/**
 * Money held back on a construction contract, and when it comes out.
 *
 * THE TWO RELEASES ARE SEPARATE AND YEARS APART. Half at practical completion,
 * half at the end of the defects period — usually twelve months later — and a
 * single "retention held" figure hides that the second half is owed for a year
 * after the job feels finished.
 *
 * THE RELEASE DATES ARE SHOWN, because retention is the money most often
 * forgotten. A subcontractor who does not chase the second release frequently
 * never receives it, and nothing on any invoice reminds them.
 *
 * THE PERCENTAGE AND THE AMOUNT ARE BOTH SHOWN. The percentage is what was
 * agreed and the amount is what is missing, and reconciling one against the
 * other is the check somebody actually does.
 *
 * OVERDUE RELEASES ARE MARKED. A release date that has passed with the money
 * still held is a conversation, and it is invisible in a statement of account.
 */
export function RetentionLine({ percent, totalHeld, firstRelease, secondRelease, className }: {
  /** Percentage of the contract retained. */
  percent?: number;
  /** Pre-formatted total currently held. */
  totalHeld: string;
  /** Release at practical completion. */
  firstRelease?: { amount: string; on?: string; released?: boolean; overdue?: boolean };
  /** Release at the end of the defects period. */
  secondRelease?: { amount: string; on?: string; released?: boolean; overdue?: boolean };
  className?: string;
}) {
  const part = (label: string, r?: { amount: string; on?: string; released?: boolean; overdue?: boolean }) =>
    r && (
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className={cn(r.overdue && "font-medium")}>{label}</span>
          <span className="block text-xs text-muted-foreground">
            {r.released ? "Released" : r.overdue ? `Was due ${r.on} — still held` : r.on ? `Due ${r.on}` : "No date set"}
          </span>
        </span>
        <span className={cn("shrink-0 tabular-nums", r.released && "text-muted-foreground line-through decoration-from-font")}>
          {r.amount}
        </span>
      </div>
    );
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="flex items-baseline justify-between gap-3">
        <span>
          Retention held
          {percent !== undefined && <span className="text-muted-foreground"> · {percent}%</span>}
        </span>
        <span className="font-medium tabular-nums">{totalHeld}</span>
      </p>
      {part("At practical completion", firstRelease)}
      {part("At the end of the defects period", secondRelease)}
    </div>
  );
}
