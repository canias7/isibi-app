import { cn } from "@/lib/utils";
/**
 * Somebody suggested again — with why, since they were passed on before.
 *
 * RE-SUGGESTING WITHOUT EXPLANATION LOOKS BROKEN. Somebody who passed and sees
 * the same name a month later assumes the system forgot, and stops trusting it.
 * The change that makes it worth a second look is the entire justification for
 * showing it.
 *
 * IT SAYS WHICH SIDE CHANGED. "They now say they can travel" is a reason to
 * look again; "you widened your area" is a consequence of your own action, and
 * conflating them makes the suggestion feel imposed.
 *
 * A SUGGESTION CANNOT BE REPEATED INDEFINITELY. Somebody passed on twice for
 * the same reason should not appear a third time, and the count is shown so a
 * person can see the system is not simply cycling.
 *
 * PASSING PERMANENTLY IS OFFERED HERE, because this is the moment somebody
 * wants it and the only moment they are thinking about it.
 */
export function RematchNote({ name, previouslyPassedOn, whatChanged, changedSide, timesSuggested = 2, onNeverAgain, className }: {
  name?: string;
  /** Free text — "in March". */
  previouslyPassedOn?: string;
  /** What is different now. */
  whatChanged?: string;
  /** Whose circumstances moved. */
  changedSide?: "them" | "you";
  timesSuggested?: number;
  onNeverAgain?: () => void;
  className?: string;
}) {
  return (
    <div data-slot="rematch-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        You passed on {name ?? "this one"}
        {previouslyPassedOn ? ` ${previouslyPassedOn}` : " before"}.
      </p>
      <p className={cn("text-xs", whatChanged ? "" : "font-medium")}>
        {whatChanged
          ? `${changedSide === "you" ? "Since then you " : changedSide === "them" ? "Since then they " : "Since then, "}${whatChanged}.`
          : "Nothing has changed since — this should not be here, and we would rather you told us."}
      </p>
      {timesSuggested > 2 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Suggested {timesSuggested} times now.
        </p>
      )}
      {onNeverAgain && (
        <button type="button" onClick={onNeverAgain} className="text-xs underline underline-offset-2">
          Do not suggest this again
        </button>
      )}
    </div>
  );
}
