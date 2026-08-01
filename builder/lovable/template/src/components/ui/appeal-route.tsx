import { cn } from "@/lib/utils";
/**
 * How to challenge a decision — with the deadline, which is the whole thing.
 *
 * THE DEADLINE IS THE HEADLINE. Appeal rights lapse, silently, and the single
 * most common reason a challenge fails is that it was late. Every other detail
 * on this component is worthless to somebody who has missed it.
 *
 * IT DISTINGUISHES INTERNAL REVIEW FROM AN INDEPENDENT APPEAL, because they are
 * usually sequential and skipping the first often makes the second inadmissible.
 * Presenting them as alternatives is a way to lose a valid case.
 *
 * A LATE APPEAL IS OFTEN STILL POSSIBLE AND IT SAYS SO. Most schemes allow one
 * out of time for good reason, and the person who has just realised they are
 * late is exactly the person who assumes it is over.
 *
 * IT NAMES WHETHER HELP IS FREE AND INDEPENDENT. Paid representation is not
 * required for most of these, and people spend money they do not have on the
 * assumption that it is.
 */
export function AppealRoute({ decision, deadline, daysLeft, firstStep, thenStep, lateAllowed = true, helpNote, className }: {
  /** What is being challenged. */
  decision?: string;
  /** Free text — "14 September". */
  deadline?: string;
  /** Days remaining, where the caller has computed it. */
  daysLeft?: number;
  /** The internal review, usually. */
  firstStep: string;
  /** The independent stage after it. */
  thenStep?: string;
  lateAllowed?: boolean;
  /** Free, independent advice. */
  helpNote?: string;
  className?: string;
}) {
  const urgent = daysLeft !== undefined && daysLeft <= 7;
  const gone = daysLeft !== undefined && daysLeft < 0;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {decision && <p className="text-xs text-muted-foreground">{decision}</p>}
      <p className={cn(urgent || gone ? "font-medium" : "")}>
        {gone
          ? "The normal deadline has passed."
          : deadline
            ? `You have until ${deadline} to challenge this.`
            : "There is a deadline for challenging this."}
        {daysLeft !== undefined && daysLeft >= 0 && (
          <span className="tabular-nums"> {daysLeft === 0 ? "Today is the last day." : `${daysLeft} days left.`}</span>
        )}
      </p>
      <p className="text-xs">First: {firstStep}</p>
      {thenStep && (
        <p className="text-xs">
          Then, if you are still unhappy: {thenStep}
          <span className="block text-muted-foreground">Do the first step first — skipping it can make this stage unavailable.</span>
        </p>
      )}
      {gone && lateAllowed && (
        <p className="text-xs">
          A late challenge can still be accepted if you had a good reason. Say what it was and ask anyway.
        </p>
      )}
      {helpNote && <p className="text-xs text-muted-foreground">{helpNote}</p>}
    </div>
  );
}
