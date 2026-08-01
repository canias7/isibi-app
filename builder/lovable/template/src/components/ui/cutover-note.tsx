import { cn } from "@/lib/utils";
/**
 * The moment a system is replaced — what stops, when, and how to go back.
 *
 * THE ROLLBACK PLAN IS PART OF THE NOTICE. A cutover announced without one is
 * one nobody can approve, and the answer is often "we cannot" — which is worth
 * knowing in advance rather than at 3am. Saying there is no way back is a valid
 * and important answer.
 *
 * THE FREEZE WINDOW IS NAMED SEPARATELY from the cutover itself. Work usually
 * has to stop before the switch and cannot resume until after, and the window
 * people must plan around is the whole of that, not the ten minutes of actual
 * switching.
 *
 * WHAT TO DO DURING IT IS STATED. "Write it on paper and enter it afterwards"
 * is a real instruction that keeps a business running, and its absence is why
 * cutovers produce a day of lost records.
 *
 * TIMES ARE ABSOLUTE AND CARRY A ZONE. A cutover notice read in another country
 * with a bare "2am" is a notice about the wrong night.
 */
export function CutoverNote({ from, to, at, freezeFrom, freezeUntil, duringInstructions, rollback, className }: {
  /** The old system. */
  from: string;
  /** The new one. */
  to: string;
  /** Free text with a zone — "Sunday 02:00 UTC". */
  at: string;
  freezeFrom?: string;
  freezeUntil?: string;
  /** What to do while it is down. */
  duringInstructions?: string;
  /** How to go back, or absent if there is no way. */
  rollback?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 rounded-md border border-border p-3 text-sm", className)}>
      <p>
        <span className="font-medium">{from} is replaced by {to}</span>
        <span className="block text-xs text-muted-foreground">at {at}</span>
      </p>
      {(freezeFrom || freezeUntil) && (
        <p className="text-xs text-muted-foreground">
          Nothing can be changed from <span className="text-foreground">{freezeFrom ?? at}</span>
          {freezeUntil && <> until <span className="text-foreground">{freezeUntil}</span></>}.
        </p>
      )}
      {duringInstructions && (
        <p className="text-xs">
          <span className="text-muted-foreground">During that time: </span>{duringInstructions}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {rollback
          ? <>If it goes wrong: {rollback}</>
          : <span className="font-medium text-foreground">There is no way back once this starts.</span>}
      </p>
    </div>
  );
}
