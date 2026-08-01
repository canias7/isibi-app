import { cn } from "@/lib/utils";
/**
 * Whether interest goes both ways — without leaking one side's answer.
 *
 * THE OTHER SIDE'S ANSWER IS NEVER REVEALED UNLESS IT IS MUTUAL. That is the
 * whole design. Showing "they are interested, you have not answered" tells
 * somebody they are wanted before they have decided, which changes the
 * decision; showing "they declined" before you have answered is a rejection
 * nobody asked to receive.
 *
 * "NOT YET" AND "NO" ARE THE SAME OUTWARD STATE, deliberately. A system that
 * distinguishes them lets somebody infer a decline from silence plus a change,
 * which is a rejection with extra steps.
 *
 * A MUTUAL MATCH SAYS WHO MOVES NEXT. Two people both told they matched and
 * neither told to act is how most matches die.
 *
 * IT IS EXPLICIT THAT DECLINING IS NOT COMMUNICATED. Knowing a decline is
 * private is what makes people willing to decline honestly, which is what makes
 * the whole thing work.
 */
export function MutualInterest({ theirName, youSaid, mutual, nextStep, expiresIn, className }: {
  theirName?: string;
  /** Your own answer, which is safe to show you. */
  youSaid?: "yes" | "no" | "not-yet";
  /** True only when both sides said yes. */
  mutual?: boolean;
  /** Who does what now. */
  nextStep?: string;
  /** Free text — "4 days". */
  expiresIn?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {mutual ? (
        <>
          <p className="font-medium">
            It is mutual{theirName ? ` — ${theirName} is interested too` : ""}.
          </p>
          <p className="text-xs">
            {nextStep ?? "Either of you can start the conversation. Somebody has to go first."}
          </p>
        </>
      ) : (
        <>
          <p>
            {youSaid === "yes"
              ? "You have said you are interested."
              : youSaid === "no"
                ? "You have passed on this one."
                : "You have not answered yet."}
          </p>
          <p className="text-xs text-muted-foreground">
            We will not tell you what they said unless you both say yes.
          </p>
        </>
      )}
      {!mutual && youSaid !== "no" && (
        <p className="text-xs text-muted-foreground">
          Passing is private — they are never told, which is why it is worth being honest.
        </p>
      )}
      {expiresIn && !mutual && (
        <p className="text-xs">This one closes in {expiresIn}.</p>
      )}
    </div>
  );
}
