import { cn } from "@/lib/utils";
/**
 * One arm of a study — what it receives, and how many are in it.
 *
 * RECRUITMENT IS SHOWN AGAINST THE TARGET, PER ARM. A study that has met its
 * overall number with one arm badly under-recruited is not a study that has met
 * its number, and a single total hides the imbalance that will show up in the
 * analysis.
 *
 * WITHDRAWALS ARE COUNTED SEPARATELY FROM THE ENROLLED FIGURE. Reporting only
 * the enrolled count overstates what the arm can actually deliver, and
 * differential dropout between arms is itself a finding.
 *
 * IT DOES NOT REVEAL ALLOCATION ON A BLINDED STUDY. `blinded` renders the arm's
 * identity as a code, because a component that shows what the arm receives is a
 * component that unblinds anyone reading a screen over a shoulder.
 *
 * THE CONTROL IS DESCRIBED, not left implicit. "Placebo", "standard care" and
 * "waiting list" are ethically and statistically different, and a study
 * describing only its intervention arm is not interpretable.
 */
export function StudyArm({ name, code, receives, targetN, enrolled = 0, withdrawn = 0, blinded, isControl, className }: {
  name: string;
  /** Shown instead of the name when blinded. */
  code?: string;
  /** What this arm receives. */
  receives?: string;
  targetN?: number;
  enrolled?: number;
  withdrawn?: number;
  /** True where allocation must not be revealed. */
  blinded?: boolean;
  isControl?: boolean;
  className?: string;
}) {
  const active = enrolled - withdrawn;
  const short = targetN !== undefined && active < targetN;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {blinded ? <code className="font-mono">{code ?? "Arm"}</code> : name}
          {isControl && !blinded && <span className="text-muted-foreground"> · control</span>}
        </span>
        <span className={cn("shrink-0 tabular-nums", short && "font-medium")}>
          {active}{targetN !== undefined && ` of ${targetN}`}
        </span>
      </p>
      {blinded ? (
        <p className="text-xs text-muted-foreground">Allocation is blinded — what this arm receives is not shown here.</p>
      ) : receives ? (
        <p className="text-xs text-muted-foreground">Receives {receives}.</p>
      ) : null}
      <p className="text-xs tabular-nums text-muted-foreground">
        {enrolled} enrolled
        {withdrawn > 0 && ` · ${withdrawn} withdrawn`}
      </p>
      {short && targetN !== undefined && (
        <p className="text-xs font-medium tabular-nums">{targetN - active} short of target.</p>
      )}
    </li>
  );
}
