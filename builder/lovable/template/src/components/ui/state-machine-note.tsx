import { cn } from "@/lib/utils";
/**
 * What this record can become next, and what it cannot.
 *
 * THE ALLOWED MOVES, STATED. A form where three of five buttons fail on press
 * teaches people not to trust any of them; listing what is permitted from here
 * turns a guess into a decision.
 *
 * IT EXPLAINS THE REFUSALS TOO, which is the half normally left out. "Can't be
 * cancelled — it has already shipped" is a rule; a greyed button is a mystery,
 * and the mystery generates the support ticket.
 *
 * Deliberately a description rather than the controls. The buttons belong to the
 * caller's toolbar; this is the explanation beside them, so the two cannot
 * drift into disagreeing about the same rule.
 */
export function StateMachineNote({ state, canBecome, cannot, className }: {
  /** Where it is now. */
  state: string;
  /** What it may move to. */
  canBecome?: string[];
  /** What it cannot, and why — [{ to, why }]. */
  cannot?: { to: string; why: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 text-xs", className)}>
      <p><span className="text-muted-foreground">Now:</span> <span className="font-medium">{state}</span></p>
      {canBecome?.length ? (
        <p className="text-muted-foreground">Can become: {canBecome.join(", ")}</p>
      ) : null}
      {cannot?.length ? (
        <ul className="text-muted-foreground">
          {cannot.map((c) => <li key={c.to}>Can&apos;t be {c.to} — {c.why}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
