import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Where an appeal has got to.
 *
 * A DECISION WITH NO VISIBLE APPEAL IS INDISTINGUISHABLE FROM AN IGNORED ONE.
 * Somebody who submitted an appeal and hears nothing assumes it went nowhere,
 * and the second and third submissions that follow are what clog the queue.
 *
 * IT STATES THE EXPECTED WAIT while pending. "Usually within 7 days" is the
 * difference between waiting and re-submitting, and it is the cheapest thing to
 * add.
 *
 * A REFUSED APPEAL CARRIES ITS REASON AND WHATEVER COMES NEXT. Ending at "your
 * appeal was unsuccessful" with no further route is the point at which people
 * go public instead.
 */
export function AppealStatus({ state, submittedAt, decidedAt, reason, expectedWithin, nextStep, className }: {
  state: "pending" | "upheld" | "refused";
  submittedAt?: string | number | Date;
  decidedAt?: string | number | Date;
  /** Why it was refused. */
  reason?: string;
  /** "7 days" */
  expectedWithin?: string;
  nextStep?: React.ReactNode;
  className?: string;
}) {
  const WORD = { pending: "Being reviewed", upheld: "Appeal upheld", refused: "Appeal refused" } as const;
  return (
    <div className={cn("flex flex-col gap-1 text-sm", className)}>
      <p className="font-medium">{WORD[state]}</p>
      <p className="text-xs text-muted-foreground">
        {submittedAt && (
          <>Submitted <time dateTime={new Date(submittedAt).toISOString()}><DateFormat date={submittedAt} /></time></>
        )}
        {state === "pending" && expectedWithin ? ` · usually decided within ${expectedWithin}` : ""}
        {decidedAt && (
          <> · decided <time dateTime={new Date(decidedAt).toISOString()}><DateFormat date={decidedAt} /></time></>
        )}
      </p>
      {reason && <p className="text-muted-foreground">{reason}</p>}
      {nextStep && <p>{nextStep}</p>}
    </div>
  );
}
