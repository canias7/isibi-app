import { cn } from "@/lib/utils";
/**
 * "The other party disagrees."
 *
 * BOTH SIDES ARE ACKNOWLEDGED WITHOUT EITHER BEING ENDORSED. A dispute rendered
 * as one party's complaint reads as a finding of fact against the other, and a
 * platform that does that has taken a side before deciding.
 *
 * THE CONTENT STAYS VISIBLE. Hiding a disputed review or claim while it is
 * examined is a takedown by default, and it is the mechanism people abuse by
 * disputing anything inconvenient.
 *
 * THE STAGE IS STATED so nobody assumes a decision has been reached. "Being
 * looked at" and "decided" are the two things a reader needs to tell apart.
 */
export function DisputeNote({ what = "This", stage, by, className }: {
  what?: string;
  stage: "raised" | "reviewing" | "resolved";
  /** Who disputed it — "the business". */
  by?: string;
  className?: string;
}) {
  const WORD = {
    raised: "has been disputed",
    reviewing: "is being looked at",
    resolved: "was disputed and has been decided",
  } as const;
  return (
    <p data-slot="dispute-note" role="status" className={cn("rounded-md border border-dashed border-border px-3 py-1.5 text-xs", className)}>
      <span className="font-medium">{what} {WORD[stage]}</span>
      {by && <span className="text-muted-foreground"> by {by}</span>}
      <span className="text-muted-foreground"> — it stays visible while that happens.</span>
    </p>
  );
}
