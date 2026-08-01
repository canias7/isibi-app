import { cn } from "@/lib/utils";
/**
 * What a triage assessment decided, and what the person should do now.
 *
 * THE ADVICE IS THE OUTPUT, NOT THE CATEGORY. Somebody who has just been assessed
 * wants to know where to go and by when; the internal priority code is for the
 * service. Leading with the code is how people leave an assessment knowing their
 * number and not their instruction.
 *
 * THE SAFETY NET IS ALWAYS PRESENT AND IS NEVER OPTIONAL. Every triage decision
 * is made on incomplete information, and "come back or seek help if X happens" is
 * the part that catches the ones it got wrong. A component that made it optional
 * would let it be omitted exactly when somebody was in a hurry.
 *
 * "NOT AN EMERGENCY" IS SAID CAREFULLY. It is not a promise that nothing is
 * wrong, and phrasing it as reassurance is how somebody talks themselves out of
 * going back when things change.
 *
 * NO DIAGNOSIS. Triage decides urgency and destination. A component that
 * displayed a condition would be presenting a sorting decision as a clinical one.
 */
export function TriageOutcome({ goWhere, byWhen, safetyNet, assessedBy, at, priorityCode, className }: {
  /** The output. Where to go. */
  goWhere: string;
  byWhen?: string;
  /** Never optional. The part that catches a wrong decision. */
  safetyNet?: string;
  assessedBy?: string;
  at?: string;
  /** For the service, not for the person. Shown last and small. */
  priorityCode?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="text-base font-medium">{goWhere}</p>
      {byWhen && <p>{byWhen}</p>}
      <p className={cn("text-sm", safetyNet ? "font-medium" : "font-medium")}>
        {safetyNet ??
          "No safety-net advice recorded. Every triage decision is made on incomplete information and this is the part that catches the wrong ones."}
      </p>
      <p className="text-xs text-muted-foreground">
        This decides how urgently you are seen and where. It is not a diagnosis and nothing here says what is wrong.
      </p>
      <p className="text-xs text-muted-foreground">
        {[assessedBy && `Assessed by ${assessedBy}`, at, priorityCode].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
