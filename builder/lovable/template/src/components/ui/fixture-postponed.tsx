import { cn } from "@/lib/utils";
/**
 * A match called off — with the rearrangement, which is the hard part.
 *
 * THE REARRANGED DATE IS THE HEADLINE, or its absence is. A postponement notice
 * that does not say when it will be played leaves two squads, a referee and a
 * ground unable to plan, and "to be rearranged" for six weeks is how a fixture
 * backlog forms.
 *
 * WHO DECIDED AND WHEN IS RECORDED. Late calls are the ones that cost people a
 * wasted journey, and the time of the decision is what a complaint or a
 * reimbursement claim turns on.
 *
 * IT SAYS WHETHER TO TRAVEL. Where a decision is pending, that is the only
 * question anybody has, and a page that describes the weather instead of
 * answering it is useless.
 *
 * THE REASON MATTERS BECAUSE IT DETERMINES WHO PAYS. A waterlogged pitch, an
 * unavailable referee and a team failing to appear have entirely different
 * consequences under most competition rules.
 */
export function FixturePostponed({ fixture, reason, decidedBy, decidedAt, rearrangedFor, decisionPending, travelAdvice, className }: {
  fixture: string;
  /** "Waterlogged pitch", "no referee available", "away side unable to raise a team". */
  reason?: string;
  decidedBy?: string;
  /** Free text — "Saturday, 09:40". */
  decidedAt?: string;
  /** Free text, or undefined. */
  rearrangedFor?: string;
  /** True where the call has not been made. */
  decisionPending?: boolean;
  /** What to do meanwhile. */
  travelAdvice?: string;
  className?: string;
}) {
  return (
    <div data-slot="fixture-postponed" className={cn("space-y-0.5 text-sm", className)}>
      <p className="font-medium">
        {decisionPending ? `${fixture} — decision not yet made` : `${fixture} is off`}
      </p>
      {reason && <p className="text-xs">{reason}</p>}
      {decisionPending ? (
        <p className="text-xs font-medium">
          {travelAdvice ?? "Do not set off until this is confirmed."}
        </p>
      ) : (
        <p className={cn("text-xs", rearrangedFor ? "" : "font-medium")}>
          {rearrangedFor
            ? `Rearranged for ${rearrangedFor}.`
            : "No new date yet. Chase it — backlogs build from here."}
        </p>
      )}
      {(decidedBy || decidedAt) && (
        <p className="text-xs text-muted-foreground">
          {decidedBy ? `Called off by ${decidedBy}` : "Called off"}
          {decidedAt && ` at ${decidedAt}`}
        </p>
      )}
    </div>
  );
}
